import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { baselineHash, type createMcpLinks } from "./mcp-links.ts";
import type { createMcpImports } from "./mcp-import.ts";
import type { createMcpResolution } from "./mcp-resolution.ts";
import type { createConnections } from "./connections.ts";

export const scheduleIntervals = [15, 30, 60, 180, 360, 720, 1440] as const;
export function validScheduleInterval(value: unknown): value is number {
  return typeof value === "number" && scheduleIntervals.some((interval) => interval === value);
}
export function nextScheduleRun(interval: number, now = Date.now()) {
  if (!validScheduleInterval(interval)) throw new Error("Invalid synchronization interval.");
  return new Date(now + interval * 60000).toISOString();
}
type Schedule = { intervalMinutes: number; nextRunAt: string; updateToken: string | null; mappingHash: string; generation: string; pauseReason: string | null };
export function createMcpSchedules(
  db: DatabaseSync,
  connections: ReturnType<typeof createConnections>,
  imports: ReturnType<typeof createMcpImports>,
  links: ReturnType<typeof createMcpLinks>,
  resolution: ReturnType<typeof createMcpResolution>,
) {
  let ticking = false;
  function owner(profileId: string, id: string) { links.reviewLinks(profileId, id); }
  function read(id: string) {
    return db.prepare("SELECT interval_minutes AS intervalMinutes,next_run_at AS nextRunAt,update_token AS updateToken,mapping_hash AS mappingHash,generation,pause_reason AS pauseReason FROM connection_mcp_schedules WHERE connection_id=?").get(id) as Schedule | undefined;
  }
  function publicSchedule(row: Schedule | undefined) {
    return row ? { intervalMinutes: row.intervalMinutes, nextRunAt: row.nextRunAt, allowRemoteWrites: !!row.updateToken, pauseReason: row.pauseReason } : null;
  }
  function getMcpSchedule(profileId: string, id: string) {
    owner(profileId, id);
    return publicSchedule(read(id));
  }
  function saveMcpSchedule(profileId: string, id: string, raw: unknown) {
    owner(profileId, id);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid schedule.");
    const value = raw as Record<string, unknown>;
    if (value.intervalMinutes === null) {
      db.prepare("DELETE FROM connection_mcp_schedules WHERE connection_id=?").run(id);
      return null;
    }
    if (value.confirm !== true || !validScheduleInterval(value.intervalMinutes) || typeof value.allowRemoteWrites !== "boolean")
      throw new Error("Confirm a supported interval and write permission.");
    if (resolution.isMcpBusy(id)) throw new Error("Synchronization in progress.");
    const mapping = imports.getMcpImport(profileId, id);
    if (!mapping?.remoteIdPath) throw new Error("Save a stable-ID import mapping first.");
    const config = resolution.getMcpUpdateConfig(profileId, id);
    const updateToken = value.allowRemoteWrites ? config.updateToken : null;
    if (value.allowRemoteWrites && (!updateToken || value.updateToken !== updateToken ||
        !connections.listConnections(profileId).find((row) => row.id === id && row.allowWrites)))
      throw new Error("Review and authorize the current remote update mapping.");
    db.prepare("INSERT INTO connection_mcp_schedules VALUES(?,?,?,?,?,?,NULL) ON CONFLICT(connection_id) DO UPDATE SET interval_minutes=excluded.interval_minutes,next_run_at=excluded.next_run_at,update_token=excluded.update_token,mapping_hash=excluded.mapping_hash,generation=excluded.generation,pause_reason=NULL")
      .run(id, value.intervalMinutes, nextScheduleRun(value.intervalMinutes), updateToken, baselineHash(mapping), randomUUID());
    return getMcpSchedule(profileId, id);
  }
  function pause(id: string, generation: string, reason: "configuration_changed" | "run_failed" | "interrupted") {
    db.prepare("UPDATE connection_mcp_schedules SET pause_reason=? WHERE connection_id=? AND generation=?").run(reason, id, generation);
  }
  async function runDueMcpSchedules() {
    if (ticking) return;
    ticking = true;
    try {
      const due = db.prepare("SELECT s.connection_id AS id,c.profile_id AS profileId FROM connection_mcp_schedules s JOIN connections c ON c.id=s.connection_id WHERE s.pause_reason IS NULL AND s.next_run_at<=? ORDER BY s.next_run_at,s.connection_id LIMIT 10")
        .all(new Date().toISOString()) as { id: string; profileId: string }[];
      for (const { id, profileId } of due) {
        if (resolution.isMcpBusy(id)) continue;
        const row = read(id);
        if (!row || row.pauseReason || row.nextRunAt > new Date().toISOString()) continue;
        try {
          // A previous interrupted batch may have performed an unconfirmed write.
          if (resolution.listMcpSyncHistory(profileId, id)[0]?.status === "interrupted") {
            pause(id, row.generation, "interrupted"); continue;
          }
          const mapping = imports.getMcpImport(profileId, id);
          const config = resolution.getMcpUpdateConfig(profileId, id);
          if (!mapping?.remoteIdPath || baselineHash(mapping) !== row.mappingHash ||
              (row.updateToken && (row.updateToken !== config.updateToken || !connections.listConnections(profileId).find((item) => item.id === id && item.allowWrites)))) {
            pause(id, row.generation, "configuration_changed"); continue;
          }
          const claimed = db.prepare("UPDATE connection_mcp_schedules SET next_run_at=? WHERE connection_id=? AND generation=? AND next_run_at=? AND pause_reason IS NULL")
            .run(nextScheduleRun(row.intervalMinutes), id, row.generation, row.nextRunAt);
          if (!claimed.changes) continue;
          const result = await resolution.syncMcpApplications(profileId, id, { confirm: true, updateToken: row.updateToken });
          if (result.failed || result.stopped) pause(id, row.generation, "run_failed");
        } catch { pause(id, row.generation, "run_failed"); }
      }
    } finally { ticking = false; }
  }
  return { getMcpSchedule, saveMcpSchedule, runDueMcpSchedules };
}
