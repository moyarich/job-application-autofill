import { subscribeApplication } from "@moyarich/job-boards/automation";
import { createServer } from "node:http";
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
) {
  return createServer(async (request, response) => {
    const req: ApiRequest = {
      method: request.method || "GET",
      url: new URL(request.url || "/", "http://localhost"),
      headers: request.headers,
      readJson: () => readNodeJson(request),
    };
    try {
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
        "X-Content-Type-Options": "nosniff",
      });
      const body =
        contentType === "application/json"
          ? JSON.stringify(result.body)
          : result.body;
      if (typeof body !== "string" && !Buffer.isBuffer(body))
        throw new Error("Unsupported response body.");
      response.end(body);
    } catch (error) {
      response.writeHead(400, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Request failed",
        }),
      );
    }
  });
}
