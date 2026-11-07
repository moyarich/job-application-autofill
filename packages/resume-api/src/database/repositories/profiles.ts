import type { DatabaseSync } from "node:sqlite";

/** Prepared, parameterized SQL for the profiles repository. */
export function createProfilesStatements(db: DatabaseSync) {
  const insertProfile = db.prepare(
    "INSERT INTO profiles(id,name,created_at) VALUES (?,?,?)",
  );
  const insertState = db.prepare(
    "INSERT INTO profile_state(profile_id,revision) VALUES (?,0)",
  );
  const selectProfile = db.prepare(
    "SELECT id,name,created_at AS createdAt FROM profiles WHERE id=?",
  );
  const listProfileRows = db.prepare(
    "SELECT id,name,created_at AS createdAt FROM profiles ORDER BY created_at,id",
  );
  return { insertProfile, insertState, selectProfile, listProfileRows };
}
