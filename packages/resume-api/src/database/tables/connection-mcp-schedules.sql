CREATE TABLE IF NOT EXISTS connection_mcp_schedules (
  connection_id TEXT PRIMARY KEY REFERENCES connections(id) ON DELETE CASCADE,
  interval_minutes INTEGER NOT NULL CHECK(interval_minutes IN (15,30,60,180,360,720,1440)),
  next_run_at TEXT NOT NULL,
  update_token TEXT,
  mapping_hash TEXT NOT NULL,
  generation TEXT NOT NULL,
  pause_reason TEXT CHECK(pause_reason IS NULL OR pause_reason IN ('configuration_changed','run_failed','interrupted'))
);
CREATE INDEX IF NOT EXISTS connection_mcp_schedules_due ON connection_mcp_schedules(next_run_at) WHERE pause_reason IS NULL;
