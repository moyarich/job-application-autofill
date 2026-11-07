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
