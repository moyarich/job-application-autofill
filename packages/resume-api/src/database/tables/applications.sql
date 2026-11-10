CREATE TABLE IF NOT EXISTS applications (
 profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 id TEXT NOT NULL, resume_id TEXT,
 details_json TEXT,
 account_action TEXT CHECK(account_action IN ('signup','login')),
 company TEXT NOT NULL, role TEXT NOT NULL, url TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('saved','in_progress','ready_for_review','submitted','interview','rejected')),
 created_at TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(profile_id,id),
 FOREIGN KEY(resume_id) REFERENCES resumes(id) ON DELETE SET NULL
);
