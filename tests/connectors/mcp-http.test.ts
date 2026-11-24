import { describe, expect, it, vi } from "vitest";
import { createMcpConnector } from "../../packages/connectors/src/mcp.ts";

function fixture(resultType = "complete") {
  const request = vi.fn<typeof fetch>(async (_url, init) => {
    const message = JSON.parse(String(init?.body));
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("MCP-Protocol-Version")).toBe("2026-07-28");
    expect(new Headers(init?.headers).has("Mcp-Session-Id")).toBe(false);
    const result = message.method === "tools/list"
      ? { resultType, tools: [{ name: "search", inputSchema: { type: "object" } }] }
      : { resultType, content: [{ type: "text", text: "done" }] };
    return new Response("data: " + JSON.stringify({ jsonrpc: "2.0", id: message.id, result }) + "\r\n\r\n", { headers: { "Content-Type": "text/event-stream" } });
  });
  const connector = createMcpConnector({
    manifest: { id: "test", name: "Test", description: "", version: "1", authentication: "none" },
    endpoint: "https://example.com/mcp",
    tools: { search: "read" },
  }, request);
  return { request, session: connector.connect({ connectionId: "c", profileId: "p", configuration: {}, getSecret: async () => undefined }) };
}

describe("MCP stateless HTTP", () => {
  it("reads SSE results without initialization or remote session cleanup", async () => {
    const { request, session } = fixture();
    const connection = await session;
    expect(await connection.callTool("search", {})).toMatchObject({ content: [{ text: "done" }] });
    await connection.close();
    expect(request.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).method)).toEqual(["tools/list", "tools/call"]);
  });

  it("rejects unsupported results without protocol fallback", async () => {
    const { request, session } = fixture("unsupported");
    const connection = await session;
    await expect(connection.listTools()).rejects.toThrow("Unsupported MCP result type");
    expect(request).toHaveBeenCalledTimes(1);
    await connection.close();
  });
});
