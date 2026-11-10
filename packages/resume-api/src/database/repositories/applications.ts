import type { DatabaseSync } from "node:sqlite";

/** Application data and revisions belong to each application row. */
export function createApplicationsStatements(db: DatabaseSync) {
  const getJobs = db.prepare(
    "SELECT id,company,role,url,status,created_at AS createdAt,notes,resume_id AS resumeId,account_action AS accountAction,details_json AS detailsJson,revision FROM applications WHERE profile_id=? ORDER BY created_at DESC,id",
  );
  const getJobRevision = db.prepare(
    "SELECT revision FROM applications WHERE profile_id=? AND id=?",
  );
  return { getJobs, getJobRevision };
}
