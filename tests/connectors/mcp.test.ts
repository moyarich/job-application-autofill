import { describe, expect, it, vi } from "vitest";
import { createMcpConnector } from "../../packages/connectors/src/mcp.ts";

function fixture(allowWrites = false) {
  const request = vi.fn<typeof fetch>(async (_url, init) => {
    const message = JSON.parse(String(init?.body)) as {
      id: number;
      method: string;
    };
    return Response.json({
      jsonrpc: "2.0",
      id: message.id,
      result:
        message.method === "tools/list"
          ? {
              resultType: "complete",
              tools: ["read", "write", "unknown"].map((name) => ({
                name,
                inputSchema: { type: "object" },
              })),
            }
          : { resultType: "complete", content: [] },
    });
  });
  const connector = createMcpConnector(
    {
      manifest: {
        id: "example-mcp",
        name: "Example",
        description: "Test server",
        version: "1.0.0",
        authentication: "token",
      },
      endpoint: "https://example.com/mcp",
      tools: { read: "read", write: "write" },
    },
    request,
  );
  const session = connector.connect({
    connectionId: "connection",
    profileId: "profile",
    configuration: { allowWrites },
    getSecret: async () => "test-token",
  });
  return { request, session };
}

describe("MCP connector", () => {
  it("discovers only explicitly allowed tools", async () => {
    const { session } = fixture();
    expect((await (await session).listTools()).map((tool) => tool.name)).toEqual([
      "read",
    ]);
  });

  it("calls a permitted tool with protocol headers and credentials", async () => {
    const { request, session } = fixture(true);
    await (await session).callTool("write", { value: 1 });
    const init = request.mock.calls[1][1];
    const headers = new Headers(init?.headers);
    expect(headers.get("Mcp-Method")).toBe("tools/call");
    expect(headers.get("Mcp-Name")).toBe("write");
    expect(headers.get("Authorization")).toBe("Bearer test-token");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      method: "tools/call",
      params: { name: "write", arguments: { value: 1 } },
    });
  });

  it("rejects unapproved tools and closed sessions", async () => {
    const { request, session } = fixture();
    const connection = await session;
    await expect(connection.callTool("write", {})).rejects.toThrow(
      "not allowed",
    );
    expect(request).toHaveBeenCalledTimes(1);
    await connection.close();
    await expect(connection.listTools()).rejects.toThrow("closed");
  });
});
