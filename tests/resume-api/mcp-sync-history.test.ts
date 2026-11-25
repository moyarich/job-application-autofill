import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { createMcpSyncHistory, syncRunStatus } from "../../packages/resume-api/src/database/repositories/mcp-sync-history.ts";

const summary = { checked: 4, unchanged: 1, applied: 3, deferred: 0, failed: 0, stopped: false };
describe("MCP synchronization history", () => {
  it("classifies completed, partial and failed runs", () => {
    expect(syncRunStatus(summary)).toBe("completed");
    expect(syncRunStatus({ ...summary, applied: 2, deferred: 1 })).toBe("partial");
    expect(syncRunStatus({ ...summary, applied: 1, failed: 1, stopped: true })).toBe("partial");
    expect(syncRunStatus({ ...summary, applied: 0, failed: 1, stopped: true })).toBe("failed");
  });
  it("persists progress and scopes run history by connection", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("CREATE TABLE connection_sync_runs(id TEXT PRIMARY KEY, connection_id TEXT, status TEXT, started_at TEXT, finished_at TEXT, result_json TEXT, failure_code TEXT)");
      const history = createMcpSyncHistory(db);
      const id = history.start("a");
      history.start("b");
      history.progress("a", id, { ...summary, applied: 1, deferred: 2 });
      expect(history.list("a", true)[0]).toMatchObject({ id, status: "running", result: { applied: 1 } });
      expect(history.list("a", false)[0].status).toBe("interrupted");
      history.finish("a", id, summary, null);
      expect(history.list("a", false)).toMatchObject([{ id, status: "completed", result: summary }]);
      expect(history.list("b", false)).toHaveLength(1);
      expect(history.list("other", false)).toEqual([]);
    } finally { db.close(); }
  });
});
