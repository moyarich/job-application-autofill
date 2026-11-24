import type {
  Connector,
  ConnectorContext,
  ConnectorManifest,
  ConnectorSession,
} from "./types.js";

export type {
  Connector,
  ConnectorContext,
  ConnectorManifest,
  ConnectorSession,
  ConnectorTool,
} from "./types.js";

/** Registry of trusted, explicitly registered connector implementations. */
export class ConnectorRegistry {
  private readonly connectors = new Map<string, Connector>();

  register(connector: Connector): void {
    const id = connector.manifest.id;
    if (!/^[a-z][a-z0-9-]*$/.test(id)) {
      throw new Error("Invalid connector identifier.");
    }
    if (this.connectors.has(id)) {
      throw new Error("Connector already registered: " + id);
    }
    this.connectors.set(id, connector);
  }

  list(): ConnectorManifest[] {
    return Array.from(this.connectors.values(), (connector) => ({
      ...connector.manifest,
    }));
  }

  async connect(
    id: string,
    context: ConnectorContext,
  ): Promise<ConnectorSession> {
    const connector = this.connectors.get(id);
    if (!connector) {
      throw new Error("Unknown connector: " + id);
    }
    const session = await connector.connect(context);
    let closed = false;
    const ensureOpen = () => {
      if (closed) throw new Error("Connector session is closed.");
    };
    return {
      async listTools() {
        ensureOpen();
        return session.listTools();
      },
      async callTool(name, input) {
        ensureOpen();
        const tools = await session.listTools();
        ensureOpen();
        if (!tools.some((tool) => tool.name === name)) {
          throw new Error("Unknown connector tool: " + name);
        }
        return session.callTool(name, input);
      },
      async close() {
        if (closed) return;
        closed = true;
        await session.close();
      },
    };
  }
}

export function createConnectorRegistry(): ConnectorRegistry {
  return new ConnectorRegistry();
}
