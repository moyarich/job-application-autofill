CREATE TABLE IF NOT EXISTS connection_record_links (
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  base_id TEXT NOT NULL,
  table_id TEXT NOT NULL,
  remote_id TEXT NOT NULL,
  local_hash TEXT NOT NULL,
  remote_hash TEXT NOT NULL,
  linked_at TEXT NOT NULL,
  PRIMARY KEY(connection_id,base_id,table_id,remote_id),
  UNIQUE(connection_id,base_id,table_id,application_id),
  FOREIGN KEY(profile_id,application_id) REFERENCES applications(profile_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS connection_transfer_runs (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK(direction IN ('import','export')),
  status TEXT NOT NULL CHECK(status IN ('running','completed','failed')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json))
);
CREATE INDEX IF NOT EXISTS connection_transfer_runs_recent
  ON connection_transfer_runs(connection_id,started_at DESC,id);
