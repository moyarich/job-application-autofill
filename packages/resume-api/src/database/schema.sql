CREATE TABLE IF NOT EXISTS profiles (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profile_contact (
 id TEXT PRIMARY KEY,
 profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0,1)),
 first_name TEXT NOT NULL DEFAULT '',
 last_name TEXT NOT NULL DEFAULT '',
 email TEXT NOT NULL DEFAULT '',
 phone TEXT NOT NULL DEFAULT '',
 location TEXT NOT NULL DEFAULT '',
 linkedin TEXT NOT NULL DEFAULT '',
 github TEXT NOT NULL DEFAULT '',
 website TEXT NOT NULL DEFAULT '',
 extra_json TEXT NOT NULL DEFAULT '{}',
 UNIQUE(profile_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_default_contact_per_profile
 ON profile_contact(profile_id) WHERE is_default=1;
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
CREATE TABLE IF NOT EXISTS employer_accounts (
 profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 provider TEXT NOT NULL, employer_key TEXT NOT NULL,
 employer_name TEXT NOT NULL, host TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('setup_required','ready')),
 updated_at TEXT NOT NULL, PRIMARY KEY(profile_id,provider,employer_key)
);
CREATE TABLE IF NOT EXISTS applications (
 profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 id TEXT NOT NULL, resume_id TEXT,
 company TEXT NOT NULL, role TEXT NOT NULL, url TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('saved','in_progress','ready_for_review','submitted','interview','rejected')),
 created_at TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(profile_id,id),
 FOREIGN KEY(resume_id) REFERENCES resumes(id) ON DELETE SET NULL
);
