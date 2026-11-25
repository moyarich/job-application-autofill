CREATE TABLE IF NOT EXISTS connection_mcp_baselines (
  connection_id TEXT NOT NULL,
  remote_id TEXT NOT NULL,
  local_hash TEXT NOT NULL,
  remote_hash TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  PRIMARY KEY(connection_id,remote_id),
  FOREIGN KEY(connection_id,remote_id) REFERENCES connection_mcp_links(connection_id,remote_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS connection_mcp_update_workflows (
  connection_id TEXT PRIMARY KEY REFERENCES connections(id) ON DELETE CASCADE,
  config_json TEXT NOT NULL CHECK(json_valid(config_json))
);
