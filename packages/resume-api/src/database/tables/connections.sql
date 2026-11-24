CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  connector_id TEXT NOT NULL,
  name TEXT NOT NULL,
  allow_writes INTEGER NOT NULL DEFAULT 0 CHECK(allow_writes IN (0,1)),
  credential TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS connections_profile ON connections(profile_id);
