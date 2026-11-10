import type { DatabaseSync } from "node:sqlite";

/** Prepared, parameterized SQL for the resumes repository. */
export function createResumesStatements(db: DatabaseSync) {
  const insertResume = db.prepare(
    "INSERT INTO resumes(id,profile_id,contact_id,name,content_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
  );
  const listResumeRows = db.prepare(
    "SELECT id,name,contact_id AS contactId,created_at AS createdAt,updated_at AS updatedAt FROM resumes WHERE profile_id=? ORDER BY created_at,id",
  );
  const selectResume = db.prepare(
    "SELECT id,name,contact_id AS contactId,content_json AS json,content_revision AS revision,created_at AS createdAt,updated_at AS updatedAt FROM resumes WHERE id=? AND profile_id=?",
  );
  return { insertResume, listResumeRows, selectResume };
}
