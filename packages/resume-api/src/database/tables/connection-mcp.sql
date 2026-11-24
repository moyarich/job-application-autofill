CREATE TABLE IF NOT EXISTS connection_mcp (
  connection_id TEXT PRIMARY KEY REFERENCES connections(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  authentication TEXT NOT NULL CHECK(authentication IN ('none','token')),
  tools_json TEXT NOT NULL CHECK(json_valid(tools_json))
);
