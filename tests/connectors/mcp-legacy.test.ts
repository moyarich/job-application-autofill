import { describe, expect, it, vi } from "vitest";
import { createMcpConnector } from "../../packages/connectors/src/mcp.ts";

describe("MCP Streamable HTTP compatibility", () => {
  it("negotiates a legacy session, reads SSE results and closes the session", async () => {
    const request = vi.fn<typeof fetch>(async (_url, init) => {
      const headers = new Headers(init?.headers);
      if (init?.method === "DELETE") {
        expect(headers.get("Mcp-Session-Id")).toBe("session-1");
        return new Response(null, { status: 204 });
      }
      const message = JSON.parse(String(init?.body));
      if (message.method === "server/discover") return Response.json({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Not found" } });
      if (message.method === "initialize") return Response.json({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "Test", version: "1" } } }, { headers: { "Mcp-Session-Id": "session-1" } });
      expect(headers.get("Mcp-Session-Id")).toBe("session-1");
      expect(headers.get("MCP-Protocol-Version")).toBe("2025-06-18");
      if (message.method === "notifications/initialized") {
        expect(message.id).toBeUndefined();
        return new Response(null, { status: 202 });
      }
      const result = message.method === "tools/list" ? { tools: [{ name: "search", inputSchema: { type: "object" } }] } : { content: [{ type: "text", text: "done" }] };
      return new Response("data: " + JSON.stringify({ jsonrpc: "2.0", id: message.id, result }) + "\r\n\r\n", { headers: { "Content-Type": "text/event-stream" } });
    });
    const connector = createMcpConnector({ manifest: { id: "test", name: "Test", description: "", version: "1", authentication: "none" }, endpoint: "https://example.com/mcp", protocol: "auto", tools: { search: "read" } }, request);
    const session = await connector.connect({ connectionId: "c", profileId: "p", configuration: {}, getSecret: async () => undefined });
    expect(await session.callTool("search", {})).toMatchObject({ content: [{ text: "done" }] });
    await session.close();
    expect(request.mock.calls.at(-1)?.[1]?.method).toBe("DELETE");
  });
});
