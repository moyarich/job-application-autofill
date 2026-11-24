CREATE TABLE IF NOT EXISTS connection_mcp_links (
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  remote_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('import','export')),
  baseline_hash TEXT NOT NULL,
  linked_at TEXT NOT NULL,
  PRIMARY KEY(connection_id,remote_id),
  UNIQUE(connection_id,application_id),
  FOREIGN KEY(profile_id,application_id) REFERENCES applications(profile_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS connection_mcp_export_attempts (
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  attempted_at TEXT NOT NULL,
  PRIMARY KEY(connection_id,application_id),
  FOREIGN KEY(profile_id,application_id) REFERENCES applications(profile_id,id) ON DELETE CASCADE
);
