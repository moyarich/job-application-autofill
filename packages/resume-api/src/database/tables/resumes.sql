CREATE TABLE IF NOT EXISTS resumes (
 id TEXT PRIMARY KEY,
 profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 contact_id TEXT,
 name TEXT NOT NULL,
 content_json TEXT,
 content_revision INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 FOREIGN KEY(profile_id, contact_id) REFERENCES profile_contact(profile_id,id)
);
CREATE INDEX IF NOT EXISTS resumes_owner ON resumes(profile_id,created_at,id);
