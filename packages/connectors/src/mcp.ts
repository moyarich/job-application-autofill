import type { Connector, ConnectorManifest, ConnectorTool } from "./types.js";

export interface McpOptions {
  manifest: ConnectorManifest;
  endpoint: string;
  tools: Readonly<Record<string, ConnectorTool["access"]>>;
  /** Discovery-only sessions cannot invoke tools, even if an allowlist is supplied. */
  discoveryOnly?: boolean;
  protocol?: "modern" | "legacy" | "auto";
}

const version = "2026-07-28";
const legacyVersions = ["2025-11-25", "2025-06-18", "2025-03-26"];
const maxResponseBytes = 2 * 1024 * 1024;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid MCP object.");
  }
  return value as Record<string, unknown>;
}

/** Read bounded JSON or a request-scoped SSE response; never execute server requests. */
async function readMessage(response: Response, id: number): Promise<Record<string, unknown>> {
  const type = response.headers.get("content-type") ?? "";
  if (!response.body || (!type.includes("application/json") && !type.includes("text/event-stream"))) {
    await response.body?.cancel();
    throw new Error("Unsupported MCP response content type.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let buffer = "";
  let data: string[] = [];
  function event(): Record<string, unknown> | undefined {
    if (!data.length) return;
    const raw = data.join("\n");
    data = [];
    if (!raw.trim()) return;
    const message = record(JSON.parse(raw));
    if (message.method && message.id !== undefined)
      throw new Error("MCP server-initiated requests are not supported.");
    if (message.id === id) return message;
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      bytes += value?.byteLength ?? 0;
      if (bytes > maxResponseBytes) throw new Error("MCP response exceeds size limit.");
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (type.includes("text/event-stream")) {
        let end: number;
        while ((end = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, end).replace(/\r$/, "");
          buffer = buffer.slice(end + 1);
          if (!line) {
            const message = event();
            if (message) return message;
          } else if (line.startsWith("data:")) {
            data.push(line.slice(5).replace(/^ /, ""));
          }
        }
      }
      if (done) {
        if (type.includes("application/json")) return record(JSON.parse(buffer));
        throw new Error("MCP event stream ended before the response.");
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

class McpProtocolError extends Error {
  constructor(readonly code: number) { super("MCP protocol error."); }
}

/** Modern and legacy Streamable HTTP for trusted, host-configured servers. */
export function createMcpConnector(
  options: McpOptions,
  request: typeof fetch = fetch,
): Connector {
  const endpoint = new URL(options.endpoint);
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.hash ||
    endpoint.search
  ) {
    throw new Error("MCP requires a trusted HTTPS endpoint.");
  }
  const allowed = new Map(Object.entries(options.tools));
  return {
    manifest: { ...options.manifest },
    async connect(context) {
      if (options.manifest.authentication === "oauth2") {
        throw new Error("MCP OAuth discovery is not implemented.");
      }
      const token =
        options.manifest.authentication === "token"
          ? await context.getSecret("accessToken")
          : undefined;
      if (options.manifest.authentication === "token" && !token) {
        throw new Error("MCP access token is required.");
      }
      const controller = new AbortController();
      let nextId = 0;
      let negotiated = version;
      let sessionId: string | undefined;
      let mode: "modern" | "legacy" = options.protocol === "legacy" ? "legacy" : "modern";
      let initialized: Promise<void> | undefined;
      const protocol = options.protocol ?? "modern";
      function headersFor(method: string, params: Record<string, unknown>) {
        const headers = new Headers({
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        });
        if (token) headers.set("Authorization", "Bearer " + token);
        if (mode === "modern") {
          headers.set("MCP-Protocol-Version", version);
          headers.set("Mcp-Method", method);
          if (typeof params.name === "string") headers.set("Mcp-Name", params.name);
        } else if (method !== "initialize") {
          headers.set("MCP-Protocol-Version", negotiated);
          if (sessionId) headers.set("Mcp-Session-Id", sessionId);
        }
        return headers;
      }

      async function send(method: string, params: Record<string, unknown>, notification = false) {
        if (controller.signal.aborted) throw new Error("MCP session is closed.");
        const id = ++nextId;
        const response = await request(endpoint, {
          method: "POST",
          headers: headersFor(method, params),
          redirect: "error",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
          body: JSON.stringify({
            jsonrpc: "2.0",
            ...(notification ? {} : { id }),
            method,
            params: mode === "modern" ? {
              ...params,
              _meta: {
                "io.modelcontextprotocol/protocolVersion": version,
                "io.modelcontextprotocol/clientInfo": { name: "Moya", version: "0.1.0" },
                "io.modelcontextprotocol/clientCapabilities": {},
              },
            } : params,
          }),
        }).catch(() => { throw new Error("MCP request failed."); });
        if (notification) {
          await response.body?.cancel();
          if (response.status !== 202) throw new Error("MCP notification rejected.");
          return {};
        }
        if (!response.ok && !response.headers.get("content-type")?.includes("application/json")) {
          await response.body?.cancel();
          throw new Error("MCP HTTP error: " + response.status);
        }
        const message = await readMessage(response, id);
        if (message.jsonrpc !== "2.0" || message.id !== id) throw new Error("Invalid MCP response.");
        if (message.error) {
          const error = record(message.error);
          throw new McpProtocolError(typeof error.code === "number" ? error.code : 0);
        }
        if (!response.ok) throw new Error("MCP HTTP error: " + response.status);
        const result = record(message.result);
        if (mode === "modern" && result.resultType !== "complete") throw new Error("Unsupported MCP result type.");
        if (method === "initialize") {
          const assigned = response.headers.get("Mcp-Session-Id");
          if (assigned && !/^[\\x21-\\x7e]{1,1024}$/.test(assigned)) throw new Error("Invalid MCP session identifier.");
          sessionId = assigned ?? undefined;
        }
        return result;
      }

      async function initialize() {
        if (protocol === "auto") {
          try {
            await send("server/discover", {});
            return;
          } catch (error) {
            // Only an explicit unsupported-method/version response triggers fallback.
            // Never retry a tool invocation in another protocol.
            if (!(error instanceof McpProtocolError) || ![-32601, -32022].includes(error.code)) throw error;
            mode = "legacy";
          }
        }
        if (mode === "legacy") {
          const result = await send("initialize", {
            protocolVersion: legacyVersions[0],
            capabilities: {},
            clientInfo: { name: "Moya", version: "0.1.0" },
          });
          if (typeof result.protocolVersion !== "string" || !legacyVersions.includes(result.protocolVersion))
            throw new Error("Unsupported negotiated MCP protocol version.");
          negotiated = result.protocolVersion;
          await send("notifications/initialized", {}, true);
        }
      }

      async function rpc(method: string, params: Record<string, unknown>) {
        if (controller.signal.aborted) throw new Error("MCP session is closed.");
        initialized ??= initialize();
        await initialized;
        return send(method, params);
      }
      async function listTools(): Promise<ConnectorTool[]> {
        const found = new Map<string, ConnectorTool>();
        const cursors = new Set<string>();
        let cursor: string | undefined;
        do {
          const result = await rpc("tools/list", cursor ? { cursor } : {});
          if (!Array.isArray(result.tools)) {
            throw new Error("Invalid MCP tool list.");
          }
          for (const entry of result.tools) {
            const item = record(entry);
            if (typeof item.name !== "string" || !/^[A-Za-z0-9_.-]{1,128}$/.test(item.name)) continue;
            const access = options.discoveryOnly ? "write" : allowed.get(item.name);
            if (!access) continue;
            if (!options.discoveryOnly && access === "write" && context.configuration.allowWrites !== true)
              continue;
            if (found.size >= 500 && !found.has(item.name)) throw new Error("MCP tool limit exceeded.");
            found.set(item.name, {
              name: item.name,
              description:
                typeof item.description === "string" ? item.description : "",
              inputSchema: record(item.inputSchema),
              access,
            });
          }
          cursor =
            typeof result.nextCursor === "string" ? result.nextCursor : undefined;
          if (cursor) {
            if (cursors.has(cursor) || cursors.size >= 99) {
              throw new Error("MCP pagination limit exceeded.");
            }
            cursors.add(cursor);
          }
        } while (cursor);
        return [...found.values()];
      }
      return {
        listTools,
        async callTool(name, input) {
          if (options.discoveryOnly) throw new Error("MCP discovery session cannot execute tools.");
          const tools = await listTools();
          if (!tools.some((tool) => tool.name === name)) {
            throw new Error("MCP tool is not allowed.");
          }
          return rpc("tools/call", { name, arguments: record(input) });
        },
        async close() {
          if (controller.signal.aborted) return;
          controller.abort();
          if (sessionId) {
            const headers = headersFor("close", {});
            try {
              const response = await request(endpoint, { method: "DELETE", headers, redirect: "error", signal: AbortSignal.timeout(3000) });
              await response.body?.cancel();
            } catch { /* Session cleanup is best effort. */ }
          }
        },
      };
    },
  };
}
