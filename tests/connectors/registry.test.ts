import { describe, expect, it, vi } from "vitest";
import {
  createConnectorRegistry,
  type Connector,
  type ConnectorContext,
} from "../../packages/connectors/src/index.ts";

const context: ConnectorContext = {
  connectionId: "connection-1",
  profileId: "profile-1",
  configuration: {},
  getSecret: async () => undefined,
};

function fixture() {
  const session = {
    listTools: vi.fn(async () => [
      {
        name: "list_records",
        description: "List records",
        inputSchema: { type: "object" },
        access: "read" as const,
      },
    ]),
    callTool: vi.fn(async () => ({ records: [] })),
    close: vi.fn(async () => {}),
  };
  const connector: Connector = {
    manifest: {
      id: "example",
      name: "Example",
      description: "Test connector",
      version: "1.0.0",
      authentication: "none",
    },
    connect: vi.fn(async () => session),
  };
  return { connector, session };
}

describe("connector registry", () => {
  it("registers and discovers trusted connectors", () => {
    const registry = createConnectorRegistry();
    const { connector } = fixture();
    registry.register(connector);
    expect(registry.list()).toEqual([connector.manifest]);
    expect(() => registry.register(connector)).toThrow("already registered");
  });

  it("rejects invalid and unknown connector identifiers", async () => {
    const registry = createConnectorRegistry();
    const { connector } = fixture();
    expect(() =>
      registry.register({
        ...connector,
        manifest: { ...connector.manifest, id: "../invalid" },
      }),
    ).toThrow("Invalid connector");
    await expect(registry.connect("missing", context)).rejects.toThrow(
      "Unknown connector",
    );
  });

  it("discovers and invokes declared tools without AI", async () => {
    const registry = createConnectorRegistry();
    const { connector, session } = fixture();
    registry.register(connector);
    const connection = await registry.connect("example", context);
    expect(connector.connect).toHaveBeenCalledWith(context);
    expect(await connection.listTools()).toHaveLength(1);
    expect(await connection.callTool("list_records", {})).toEqual({
      records: [],
    });
    await expect(connection.callTool("unknown", {})).rejects.toThrow(
      "Unknown connector tool",
    );
    expect(session.callTool).toHaveBeenCalledTimes(1);
    await connection.close();
    await connection.close();
    expect(session.close).toHaveBeenCalledTimes(1);
    await expect(connection.listTools()).rejects.toThrow("closed");
  });
});
