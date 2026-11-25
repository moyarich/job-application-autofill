import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { createConnections } from "./connections.ts";

export function remoteIdentifier(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value)) value = String(value);
  if (typeof value !== "string" || !value.trim() || value.length > 512 ||
    [...value].some((character) => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127)) return;
  return value;
}
export function validRemotePointer(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && value.length <= 512 &&
    !/~(?![01])/.test(value) && value.split("/").length <= 20;
}
export function baselineHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function createMcpLinks(db: DatabaseSync, connections: ReturnType<typeof createConnections>) {
  function requireOwner(profileId: string, id: string) {
    if (connections.listConnections(profileId).find((row) => row.id === id)?.connectorId !== "mcp") throw new Error("MCP connection not found.");
  }
  function listMcpLinks(profileId: string, id: string) {
    requireOwner(profileId, id);
    return db.prepare("SELECT application_id AS applicationId,remote_id AS remoteId,direction,linked_at AS linkedAt FROM connection_mcp_links WHERE connection_id=? AND profile_id=? ORDER BY linked_at DESC,application_id")
      .all(id, profileId) as { applicationId: string; remoteId: string; direction: string; linkedAt: string }[];
  }
  function reviewLinks(profileId: string, id: string) {
    requireOwner(profileId, id);
    return db.prepare("SELECT application_id AS applicationId,remote_id AS remoteId,direction,baseline_hash AS baselineHash FROM connection_mcp_links WHERE connection_id=? AND profile_id=? ORDER BY application_id").all(id, profileId) as { applicationId: string; remoteId: string; direction: string; baselineHash: string }[];
  }
  function listMcpUncertainExports(profileId: string, id: string) {
    requireOwner(profileId, id);
    return db.prepare("SELECT application_id AS applicationId,attempted_at AS attemptedAt FROM connection_mcp_export_attempts WHERE connection_id=? AND profile_id=? ORDER BY attempted_at DESC")
      .all(id, profileId) as { applicationId: string; attemptedAt: string }[];
  }
  function assertUnlinked(profileId: string, id: string, applicationId: string) {
    if (listMcpLinks(profileId, id).some((row) => row.applicationId === applicationId) ||
      listMcpUncertainExports(profileId, id).some((row) => row.applicationId === applicationId))
      throw new Error("Application already linked or export outcome requires reconciliation.");
  }
  function assertMappingMutable(profileId: string, id: string, previous: unknown, next: unknown) {
    if (previous && JSON.stringify(previous) !== JSON.stringify(next) &&
      (listMcpLinks(profileId, id).length || listMcpUncertainExports(profileId, id).length))
      throw new Error("Use a separate connection to change the mapping for linked records.");
  }
  function insertLink(profileId: string, id: string, applicationId: string, remoteId: string, direction: "import" | "export", baseline: unknown) {
    requireOwner(profileId, id);
    db.prepare("INSERT INTO connection_mcp_links VALUES(?,?,?,?,?,?,?)")
      .run(id, profileId, applicationId, remoteId, direction, baselineHash(baseline), new Date().toISOString());
  }
  function reserveExport(profileId: string, id: string, applicationId: string) {
    assertUnlinked(profileId, id, applicationId);
    db.prepare("INSERT INTO connection_mcp_export_attempts VALUES(?,?,?,?)").run(id, profileId, applicationId, new Date().toISOString());
  }
  function completeExport(profileId: string, id: string, applicationId: string, remoteId: string, baseline: unknown) {
    db.exec("BEGIN IMMEDIATE");
    try {
      insertLink(profileId, id, applicationId, remoteId, "export", baseline);
      db.prepare("DELETE FROM connection_mcp_export_attempts WHERE connection_id=? AND profile_id=? AND application_id=?").run(id, profileId, applicationId);
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  return { reviewLinks, listMcpLinks, listMcpUncertainExports, assertUnlinked, assertMappingMutable, insertLink, reserveExport, completeExport };
}
