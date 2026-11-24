import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  createAirtableConnector,
  createConnectorRegistry,
} from "@moyarich/connectors";
import Ajv, { type AnySchema } from "ajv";

const registry = createConnectorRegistry();
registry.register(createAirtableConnector());

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
  const listConnectors = () => registry.list();
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
    if (
      Object.keys(value).some(
        (field) => !["connectorId", "name", "accessToken", "allowWrites"].includes(field),
      ) ||
      typeof value.name !== "string" ||
      !value.name.trim() ||
      value.name.length > 120 ||
      typeof value.accessToken !== "string" ||
      !value.accessToken.trim() ||
      value.accessToken.length > 4096 ||
      /\s/.test(value.accessToken) ||
      (value.allowWrites !== undefined && typeof value.allowWrites !== "boolean") ||
      !listConnectors().some((item) => item.id === value.connectorId)
    ) {
      throw new Error("Invalid connection configuration.");
    }
    const id = randomUUID();
    db.prepare(
      "INSERT INTO connections VALUES(?,?,?,?,?,?,?)",
    ).run(
      id,
      owner,
      String(value.connectorId),
      value.name.trim(),
      Number(value.allowWrites === true),
      encrypt(value.accessToken, owner + ":" + id),
      new Date().toISOString(),
    );
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
    const session = await registry.connect(row.connectorId, {
      connectionId: id,
      profileId: owner,
      configuration: { allowWrites: Boolean(row.allowWrites) },
      getSecret: async (name) =>
        name === "accessToken" ? decrypt(row.credential, owner + ":" + id) : undefined,
    });
    try {
      return await action(session);
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
    listConnectors,
    listConnections,
    addConnection,
    removeConnection,
    listConnectionTools,
    callConnectionTool,
  };
}
