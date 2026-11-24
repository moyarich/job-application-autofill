CREATE TABLE IF NOT EXISTS connection_mappings (
  connection_id TEXT PRIMARY KEY REFERENCES connections(id) ON DELETE CASCADE,
  mapping_json TEXT NOT NULL CHECK(json_valid(mapping_json))
);
