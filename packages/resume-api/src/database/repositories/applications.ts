import type { DatabaseSync } from "node:sqlite";

/** Prepared, parameterized SQL for the applications repository. */
export function createApplicationsStatements(db: DatabaseSync) {
  const getRevision = db.prepare(
    "SELECT revision FROM profile_state WHERE profile_id=?",
  );
  const getJobs = db.prepare(
    "SELECT id,company,role,url,status,created_at AS createdAt,notes,resume_id AS resumeId FROM applications WHERE profile_id=? ORDER BY created_at DESC,id",
  );
  const insertJob = db.prepare(
    "INSERT INTO applications(profile_id,id,resume_id,company,role,url,status,created_at,notes) VALUES (?,?,?,?,?,?,?,?,?)",
  );
  const deleteJobs = db.prepare("DELETE FROM applications WHERE profile_id=?");
  return { getRevision, getJobs, insertJob, deleteJobs };
}
