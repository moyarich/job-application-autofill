import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  createAirtableConnector,
  createConnectorRegistry,
  createMcpConnector,
  type ConnectorManifest,
  type ConnectorTool,
} from "@moyarich/connectors";
import Ajv, { type AnySchema } from "ajv";

const registry = createConnectorRegistry();
registry.register(createAirtableConnector());

const mcpManifest: ConnectorManifest = {
  id: "mcp",
  name: "Custom MCP server",
  description: "Connect to an administrator-approved remote MCP endpoint.",
  version: "0.1.0",
  authentication: "token",
};

function canonicalEndpoint(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048)
    throw new Error("Invalid MCP endpoint.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
    throw new Error("MCP endpoint must be HTTPS without credentials, query or fragment.");
  return url.href;
}

export function approvedMcpEndpoints(): string[] {
  return [...new Set((process.env.MOYA_MCP_ENDPOINTS ?? "").split(",")
    .map((value) => value.trim()).filter(Boolean).map(canonicalEndpoint))];
}

function requireEndpoint(value: unknown): string {
  const endpoint = canonicalEndpoint(value);
  if (!approvedMcpEndpoints().includes(endpoint)) throw new Error("MCP endpoint is not approved.");
  return endpoint;
}

type McpConfig = { endpoint: string; authentication: "none" | "token"; tools: Record<string, ConnectorTool["access"]> };
function parseMcpConfig(value: Record<string, unknown>): McpConfig {
  const endpoint = requireEndpoint(value.endpoint);
  if (value.authentication !== "none" && value.authentication !== "token")
    throw new Error("Invalid MCP authentication.");
  if (!value.tools || typeof value.tools !== "object" || Array.isArray(value.tools))
    throw new Error("Explicit MCP tool permissions are required.");
  const entries = Object.entries(value.tools);
  if (!entries.length || entries.length > 50 || entries.some(([name, access]) =>
    !/^[A-Za-z0-9_.-]{1,128}$/.test(name) || (access !== "read" && access !== "write")))
    throw new Error("Invalid MCP tool permissions.");
  return { endpoint, authentication: value.authentication, tools: Object.fromEntries(entries) as McpConfig["tools"] };
}

function key() {
  const value = process.env.MOYA_CONNECTOR_KEY ?? "";
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error("Configure MOYA_CONNECTOR_KEY before connecting.");
  }
  return Buffer.from(value, "hex");
}

function encrypt(secret: string, scope: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), nonce);
  cipher.setAAD(Buffer.from(scope));
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return [nonce, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64"))
    .join(".");
}

function decrypt(value: string, scope: string) {
  const encryptionKey = key();
  try {
    const [nonce, tag, encrypted] = value.split(".").map((part) =>
      Buffer.from(part, "base64"),
    );
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey, nonce);
    decipher.setAAD(Buffer.from(scope));
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Unable to decrypt connection credentials.");
  }
}

type ConnectionRow = {
  id: string;
  connectorId: string;
  name: string;
  allowWrites: number;
  createdAt: string;
};

function metadata(row: ConnectionRow) {
  return { ...row, allowWrites: Boolean(row.allowWrites) };
}

export function createConnections(
  db: DatabaseSync,
  requireProfile: (id: string) => string,
) {
  const columns = "id,connector_id AS connectorId,name,allow_writes AS allowWrites,created_at AS createdAt";
  const ajv = new Ajv();
  const listConnectors = () => [...registry.list(), ...(approvedMcpEndpoints().length ? [mcpManifest] : [])];
  function listConnections(profileId: string) {
    return (
      db.prepare(
        "SELECT " + columns + " FROM connections WHERE profile_id=? ORDER BY name,id",
      ).all(requireProfile(profileId)) as ConnectionRow[]
    ).map(metadata);
  }

  function addConnection(profileId: string, raw: unknown) {
    const owner = requireProfile(profileId);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Invalid connection.");
    }
    const value = raw as Record<string, unknown>;
    const isMcp = value.connectorId === "mcp";
    const config = isMcp ? parseMcpConfig(value) : null;
    const needsToken = !config || config.authentication === "token";
    if (
      Object.keys(value).some(
        (field) => !["connectorId", "name", "accessToken", "allowWrites", ...(isMcp ? ["endpoint", "authentication", "tools"] : [])].includes(field),
      ) ||
      typeof value.name !== "string" ||
      !value.name.trim() ||
      value.name.length > 120 ||
      typeof value.accessToken !== "string" ||
      (needsToken && !value.accessToken.trim()) ||
      (!needsToken && value.accessToken !== "") ||
      value.accessToken.length > 4096 ||
      /\s/.test(value.accessToken) ||
      (value.allowWrites !== undefined && typeof value.allowWrites !== "boolean") ||
      !listConnectors().some((item) => item.id === value.connectorId)
    ) {
      throw new Error("Invalid connection configuration.");
    }
    const id = randomUUID();
    db.exec("BEGIN IMMEDIATE");
    try {
    db.prepare(
      "INSERT INTO connections VALUES(?,?,?,?,?,?,?)",
    ).run(
      id,
      owner,
      String(value.connectorId),
      value.name.trim(),
      Number(value.allowWrites === true),
      needsToken ? encrypt(value.accessToken, owner + ":" + id) : "",
      new Date().toISOString(),
    );
    if (config) db.prepare("INSERT INTO connection_mcp VALUES(?,?,?,?)")
      .run(id, config.endpoint, config.authentication, JSON.stringify(config.tools));
    db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return listConnections(owner).find((item) => item.id === id)!;
  }

  function removeConnection(profileId: string, id: string) {
    const result = db.prepare(
      "DELETE FROM connections WHERE profile_id=? AND id=?",
    ).run(requireProfile(profileId), id);
    if (!result.changes) throw new Error("Connection not found.");
    return { deleted: true };
  }

  async function withConnection<T>(
    profileId: string,
    id: string,
    action: (session: Awaited<ReturnType<typeof registry.connect>>) => Promise<T>,
  ) {
    const owner = requireProfile(profileId);
    const row = db.prepare(
      "SELECT " + columns + ",credential FROM connections WHERE profile_id=? AND id=?",
    ).get(owner, id) as (ConnectionRow & { credential: string }) | undefined;
    if (!row) throw new Error("Connection not found.");
    const context = {
      connectionId: id,
      profileId: owner,
      configuration: { allowWrites: Boolean(row.allowWrites) },
      getSecret: async (name: string) =>
        name === "accessToken" ? decrypt(row.credential, owner + ":" + id) : undefined,
    };
    let session;
    if (row.connectorId === "mcp") {
      const stored = db.prepare("SELECT endpoint,authentication,tools_json AS toolsJson FROM connection_mcp WHERE connection_id=?").get(id) as { endpoint: string; authentication: string; toolsJson: string } | undefined;
      if (!stored) throw new Error("MCP configuration not found.");
      const config = parseMcpConfig({ ...stored, tools: JSON.parse(stored.toolsJson) });
      const connector = createMcpConnector({
        manifest: { ...mcpManifest, authentication: config.authentication },
        endpoint: config.endpoint,
        tools: config.tools,
      });
      session = await connector.connect(context);
    } else {
      session = await registry.connect(row.connectorId, context);
    }
    try {
      return await action(session);
    } finally {
      await session.close();
    }
  }

  async function discoverMcpTools(profileId: string, raw: unknown) {
    const owner = requireProfile(profileId);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid discovery configuration.");
    const value = raw as Record<string, unknown>;
    const endpoint = requireEndpoint(value.endpoint);
    const authentication = value.authentication;
    const token = value.accessToken;
    if ((authentication !== "token" && authentication !== "none") ||
      typeof token !== "string" || token.length > 4096 || /\s/.test(token) ||
      (authentication === "token" ? !token : token !== "") ||
      Object.keys(value).some((key) => !["endpoint", "authentication", "accessToken"].includes(key)))
      throw new Error("Invalid discovery credentials.");
    const connector = createMcpConnector({
      manifest: { ...mcpManifest, authentication },
      endpoint,
      tools: {},
      discoveryOnly: true,
    });
    const session = await connector.connect({
      connectionId: "discovery",
      profileId: owner,
      configuration: { allowWrites: false },
      getSecret: async (name) => name === "accessToken" && authentication === "token" ? token : undefined,
    });
    try {
      return (await session.listTools()).map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
    } finally {
      await session.close();
    }
  }

  function listConnectionTools(profileId: string, id: string) {
    return withConnection(profileId, id, (session) => session.listTools());
  }

  function callConnectionTool(
    profileId: string,
    id: string,
    name: string,
    input: unknown,
  ) {
    return withConnection(profileId, id, async (session) => {
      const tool = (await session.listTools()).find((item) => item.name === name);
      if (!tool) throw new Error("Connection tool is unavailable.");
      if (!ajv.compile(tool.inputSchema as AnySchema)(input)) {
        throw new Error("Invalid connection tool input.");
      }
      return session.callTool(name, input);
    });
  }

  return {
    listMcpEndpoints: approvedMcpEndpoints,
    discoverMcpTools,
    listConnectors,
    listConnections,
    addConnection,
    removeConnection,
    listConnectionTools,
    callConnectionTool,
  };
}
