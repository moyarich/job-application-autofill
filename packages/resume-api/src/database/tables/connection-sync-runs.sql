CREATE TABLE IF NOT EXISTS connection_sync_runs (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('running','completed','partial','failed')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
  failure_code TEXT CHECK(failure_code IS NULL OR failure_code IN ('review_failed','resolution_failed','run_failed'))
);
CREATE INDEX IF NOT EXISTS connection_sync_runs_recent
  ON connection_sync_runs(connection_id,started_at DESC,id);
