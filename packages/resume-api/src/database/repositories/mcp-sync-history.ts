import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type SyncSummary = { checked: number; unchanged: number; applied: number; deferred: number; failed: number; stopped: boolean };
type FailureCode = "review_failed" | "resolution_failed" | "run_failed";
export function syncRunStatus(summary: SyncSummary): "completed" | "partial" | "failed" {
  if (summary.failed || summary.stopped) return summary.applied ? "partial" : "failed";
  return summary.deferred ? "partial" : "completed";
}

/** Share the connector-neutral run table with native synchronization. */
export function createMcpSyncHistory(db: DatabaseSync) {
  function start(connectionId: string) {
    const id = randomUUID();
    db.prepare("INSERT INTO connection_sync_runs(id,connection_id,status,started_at) VALUES(?,?,'running',?)")
      .run(id, connectionId, new Date().toISOString());
    return id;
  }
  function progress(connectionId: string, id: string, summary: SyncSummary) {
    db.prepare("UPDATE connection_sync_runs SET result_json=? WHERE connection_id=? AND id=? AND status='running'")
      .run(JSON.stringify(summary), connectionId, id);
  }
  function finish(connectionId: string, id: string, summary: SyncSummary | null, failureCode: FailureCode | null) {
    const status = summary ? syncRunStatus(summary) : "failed";
    db.prepare("UPDATE connection_sync_runs SET status=?,finished_at=?,result_json=?,failure_code=? WHERE connection_id=? AND id=? AND status='running'")
      .run(status, new Date().toISOString(), summary ? JSON.stringify(summary) : null, failureCode, connectionId, id);
  }
  function list(connectionId: string, active: boolean) {
    const rows = db.prepare("SELECT id,status,started_at AS startedAt,finished_at AS finishedAt,result_json AS resultJson,failure_code AS failureCode FROM connection_sync_runs WHERE connection_id=? ORDER BY started_at DESC,id DESC LIMIT 50")
      .all(connectionId) as { id: string; status: string; startedAt: string; finishedAt: string | null; resultJson: string | null; failureCode: FailureCode | null }[];
    return rows.map(({ resultJson, ...row }) => ({
      ...row,
      // A process restart can leave a running row. Never infer completion.
      status: row.status === "running" && !active ? "interrupted" : row.status,
      result: resultJson ? JSON.parse(resultJson) as SyncSummary : null,
    }));
  }
  return { start, progress, finish, list };
}
