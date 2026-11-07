CREATE TABLE IF NOT EXISTS employer_accounts (
 profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 provider TEXT NOT NULL, employer_key TEXT NOT NULL,
 employer_name TEXT NOT NULL, host TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('setup_required','ready')),
 updated_at TEXT NOT NULL, PRIMARY KEY(profile_id,provider,employer_key)
);
