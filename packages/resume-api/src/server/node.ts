import { subscribeApplication } from "@moyarich/job-boards/automation";
import { createServer, request as httpRequest } from "node:http";
import type { IncomingHttpHeaders } from "node:http";
import type { IncomingMessage } from "node:http";
import type { ApiRequest, ApiResponse } from "../types/types.ts";

const MAX_BODY = 15 * 1024 * 1024;
export async function readNodeJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const part of req) {
    const chunk = Buffer.from(part);
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("Request exceeds 15 MB.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** This is the sole node:http adapter. Swap this file for Express/Fastify. */
export function createNodeServer(
  handler: (req: ApiRequest) => Promise<ApiResponse>,
  allowedOrigin = "http://localhost:5173",
) {
  const server = createServer(async (request, response) => {
    const req: ApiRequest = {
      method: request.method || "GET",
      url: new URL(request.url || "/", "http://localhost"),
      headers: request.headers,
      readJson: () => readNodeJson(request),
    };
    try {
      // Only the Node server may reach the internal noVNC static asset server.
      if (req.method === "GET" && req.url.pathname.startsWith("/vnc/")) {
        const upstream = httpRequest({
          hostname: "127.0.0.1", port: 6080,
          path: req.url.pathname.slice(4), method: "GET",
        }, (source) => {
          response.writeHead(source.statusCode ?? 502, {
            "Content-Type": source.headers["content-type"] ?? "application/octet-stream",
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
          });
          source.pipe(response);
        });
        upstream.on("error", () => {
          if (!response.headersSent) response.writeHead(502);
          response.end();
        });
        upstream.end();
        return;
      }
      // Authenticate through the existing API handler before attaching a stream.
      // This preserves the same profile/session boundary as the normal viewer API.
      const stream = req.url.pathname.match(
        /^\/api\/apply\/([0-9a-f-]+)\/events$/,
      );
      if (stream && req.method === "GET") {
        const verified = await handler({
          ...req,
          url: new URL("/api/apply/" + stream[1], req.url),
        });
        if (verified.status !== 200) {
          response.writeHead(verified.status, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          });
          response.end(JSON.stringify(verified.body));
          return;
        }
        response.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "X-Content-Type-Options": "nosniff",
        });
        response.write("event: update\ndata: {}\n\n");
        let closed = false;
        const finish = () => {
          if (closed) return;
          closed = true;
          unsubscribe();
          clearInterval(heartbeat);
          response.end();
        };
        const unsubscribe = subscribeApplication(stream[1], () => {
          if (!closed) response.write("event: update\ndata: {}\n\n");
        });
        const heartbeat = setInterval(() => {
          if (!closed) response.write(": heartbeat\n\n");
        }, 25000);
        // IncomingMessage can close as soon as the GET request is read;
        // only the outgoing response close indicates the stream ended.
        response.on("close", finish);
        return;
      }
      const result = await handler(req);
      const contentType = result.contentType ?? "application/json";
      response.writeHead(result.status, {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      });
      const body =
        contentType === "application/json"
          ? JSON.stringify(result.body)
          : result.body;
      if (typeof body !== "string" && !Buffer.isBuffer(body))
        throw new Error("Unsupported response body.");
      response.end(body);
    } catch {
      response.writeHead(400, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      });
      // Parsing errors can include private request content; return a fixed error.
      response.end(JSON.stringify({ error: "Invalid request." }));
    }
  });
  // A WebSocket cannot supply dashboard headers. Validate the browser origin
  // and existing application session before tunneling to loopback websockify.
  server.on("upgrade", (request, socket, head) => {
    void (async () => {
      const url = new URL(request.url ?? "/", "http://localhost");
      const session = url.searchParams.get("session");
      const profile = url.searchParams.get("profile");
      const validId = (id: string | null) => !!id && /^[0-9a-f-]{36}$/i.test(id);
      if (
        url.pathname !== "/vnc/websockify" ||
        request.headers.origin !== allowedOrigin ||
        request.headers["sec-fetch-site"] === "cross-site" ||
        !validId(session) || !validId(profile)
      ) {
        socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
        return;
      }
      const verified = await handler({
        method: "GET",
        url: new URL("/api/apply/" + session, "http://localhost"),
        headers: {
          ...request.headers,
          "x-moya-client": "dashboard",
          "x-profile-id": profile!,
        },
        readJson: async () => undefined,
      });
      if (verified.status !== 200) {
        socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
        return;
      }
      const upstream = httpRequest({
        hostname: "127.0.0.1", port: 6080, path: "/websockify",
        headers: {
          ...(request.headers as IncomingHttpHeaders),
          host: "127.0.0.1:6080",
        },
      });
      upstream.once("upgrade", (reply, tunnel, tunnelHead) => {
        socket.write(`HTTP/1.1 101 Switching Protocols\r\n${reply.rawHeaders.reduce((lines, value, index, array) => index % 2 === 0 ? lines + value + ": " + array[index + 1] + "\r\n" : lines, "")}\r\n`);
        if (head.length) tunnel.write(head);
        if (tunnelHead.length) socket.write(tunnelHead);
        socket.on("error", () => tunnel.destroy());
        tunnel.on("error", () => socket.destroy());
        socket.pipe(tunnel);
        tunnel.pipe(socket);
      });
      upstream.once("response", () => socket.destroy());
      upstream.once("error", () => socket.destroy());
      socket.once("close", () => upstream.destroy());
      upstream.end();
    })().catch(() => socket.destroy());
  });
  return server;
}
