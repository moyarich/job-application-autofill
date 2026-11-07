import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import type { ApiRequest, ApiResponse } from "./types.ts";

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
export function createNodeServer(handler: (req: ApiRequest) => Promise<ApiResponse>) {
  return createServer(async (request, response) => {
    const req: ApiRequest = {
      method: request.method || "GET",
      url: new URL(request.url || "/", "http://localhost"),
      headers: request.headers,
      readJson: () => readNodeJson(request),
    };
    try {
      const result = await handler(req);
      const contentType = result.contentType ?? "application/json";
      response.writeHead(result.status, {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      const body = contentType === "application/json" ? JSON.stringify(result.body) : result.body;
      if (typeof body !== "string" && !Buffer.isBuffer(body))
        throw new Error("Unsupported response body.");
      response.end(body);
    } catch (error) {
      response.writeHead(400, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Request failed" }));
    }
  });
}
