import type { Connector, ConnectorManifest, ConnectorTool } from "./types.js";

export interface McpOptions {
  manifest: ConnectorManifest;
  endpoint: string;
  tools: Readonly<Record<string, ConnectorTool["access"]>>;
}

const version = "2026-07-28";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid MCP object.");
  }
  return value as Record<string, unknown>;
}

/** Stateless MCP JSON-response transport for trusted, host-configured servers. */
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
      async function rpc(
        method: string,
        params: Record<string, unknown>,
      ): Promise<Record<string, unknown>> {
        if (controller.signal.aborted) {
          throw new Error("MCP session is closed.");
        }
        const id = ++nextId;
        const headers = new Headers({
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "MCP-Protocol-Version": version,
          "Mcp-Method": method,
        });
        if (typeof params.name === "string") {
          headers.set("Mcp-Name", params.name);
        }
        if (token) headers.set("Authorization", "Bearer " + token);
        const response = await request(endpoint, {
          method: "POST",
          headers,
          redirect: "error",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15000),
          ]),
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            method,
            params: {
              ...params,
              _meta: { "io.modelcontextprotocol/protocolVersion": version },
            },
          }),
        }).catch(() => {
          throw new Error("MCP request failed.");
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error("MCP HTTP error: " + response.status);
        }
        if (!response.headers.get("content-type")?.includes("application/json")) {
          await response.body?.cancel();
          throw new Error("Only MCP JSON responses are supported.");
        }
        const message = record(await response.json());
        if (message.jsonrpc !== "2.0" || message.id !== id || message.error) {
          throw new Error("Invalid or unsuccessful MCP response.");
        }
        const result = record(message.result);
        if (result.resultType !== "complete") {
          throw new Error("Unsupported MCP result type.");
        }
        return result;
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
            if (typeof item.name !== "string") continue;
            const access = allowed.get(item.name);
            if (!access) continue;
            if (access === "write" && context.configuration.allowWrites !== true)
              continue;
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
          const tools = await listTools();
          if (!tools.some((tool) => tool.name === name)) {
            throw new Error("MCP tool is not allowed.");
          }
          return rpc("tools/call", { name, arguments: record(input) });
        },
        async close() {
          controller.abort();
        },
      };
    },
  };
}
