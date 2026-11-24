CREATE TABLE IF NOT EXISTS connection_schedules (
  connection_id TEXT PRIMARY KEY REFERENCES connections(id) ON DELETE CASCADE,
  interval_minutes INTEGER NOT NULL CHECK(interval_minutes IN (15,30,60,180,360,720,1440)),
  next_run_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS connection_schedules_due ON connection_schedules(next_run_at);
