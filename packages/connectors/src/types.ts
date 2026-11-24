export interface ConnectorManifest {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly authentication: "none" | "token" | "oauth2";
}

export interface ConnectorTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly access: "read" | "write";
}

export interface ConnectorSession {
  listTools(): Promise<readonly ConnectorTool[]>;
  callTool(name: string, input: unknown): Promise<unknown>;
  close(): Promise<void>;
}

export interface Connector {
  readonly manifest: ConnectorManifest;
  connect(context: ConnectorContext): Promise<ConnectorSession>;
}

export interface ConnectorContext {
  readonly connectionId: string;
  readonly profileId: string;
  readonly configuration: Readonly<Record<string, unknown>>;
  getSecret(name: string): Promise<string | undefined>;
}
