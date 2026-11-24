CREATE TABLE IF NOT EXISTS application_preferences (
 id TEXT PRIMARY KEY,
 profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0,1)),
 data_json TEXT NOT NULL DEFAULT '{}',
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL,
 UNIQUE(profile_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_default_application_preference
 ON application_preferences(profile_id) WHERE is_default=1;

CREATE TABLE IF NOT EXISTS application_preference_selections (
 profile_id TEXT NOT NULL,
 application_id TEXT NOT NULL,
 preference_id TEXT NOT NULL,
 PRIMARY KEY(profile_id,application_id),
 FOREIGN KEY(profile_id,application_id) REFERENCES applications(profile_id,id) ON DELETE CASCADE,
 FOREIGN KEY(profile_id,preference_id) REFERENCES application_preferences(profile_id,id) ON DELETE CASCADE
);
