CREATE TABLE IF NOT EXISTS connection_import_workflows (
  connection_id TEXT PRIMARY KEY REFERENCES connections(id) ON DELETE CASCADE,
  config_json TEXT NOT NULL CHECK(json_valid(config_json))
);
