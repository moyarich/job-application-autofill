CREATE TABLE IF NOT EXISTS application_answers (
  profile_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(profile_id, application_id, question),
  FOREIGN KEY(profile_id, application_id) REFERENCES applications(profile_id, id) ON DELETE CASCADE
);
