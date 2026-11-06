// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — migration: incremental runtime interface typing pending.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { validateResume } from "../resume/src/resume-schema/validate.ts";

const STATUSES = new Set(["saved","in_progress","ready_for_review","submitted","interview","rejected"]);
function validateJobs(input) {
  if (!Array.isArray(input) || input.length > 5000) throw new Error("Applications must be an array of at most 5000 jobs.");
  const ids = new Set();
  return input.map(job => {
    if (!job || typeof job !== "object" || Array.isArray(job)) throw new Error("Invalid job record.");
    for (const key of ["id","company","role","url","status","createdAt","notes"])
      if (typeof job[key] !== "string") throw new Error("Invalid job field: " + key);
    if (!/^[0-9a-f-]{36}$/i.test(job.id) || ids.has(job.id)) throw new Error("Duplicate or invalid job ID.");
    ids.add(job.id);
    if (!STATUSES.has(job.status)) throw new Error("Invalid application status.");
    if (job.url && !/^https?:\/\//i.test(job.url)) throw new Error("Invalid job URL.");
    if (job.notes.length > 50000 || job.company.length > 500 || job.role.length > 500 || job.url.length > 4000)
      throw new Error("Application data exceeds field limits.");
    return { id: job.id, company: job.company, role: job.role, url: job.url,
      status: job.status, createdAt: job.createdAt, notes: job.notes };
  });
}
export function openStore(filePath = process.env.MOYA_DB_PATH || "data/moyaapply.sqlite") {
  const path = filePath === ":memory:" ? filePath : resolve(filePath);
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") { try { chmodSync(path, 0o600); } catch { /* Filesystem permissions vary. */ } }
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  db.exec(`CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS resume_profile (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS applications (
 id TEXT PRIMARY KEY, company TEXT NOT NULL, role TEXT NOT NULL, url TEXT NOT NULL,
 status TEXT NOT NULL CHECK (status IN ('saved','in_progress','ready_for_review','submitted','interview','rejected')),
 created_at TEXT NOT NULL, notes TEXT NOT NULL DEFAULT ''
);`);
  db.prepare("INSERT OR IGNORE INTO app_meta (key,value) VALUES ('revision',0)").run();
  const getRevision = db.prepare("SELECT value FROM app_meta WHERE key='revision'");
  const profileQuery = db.prepare("SELECT json FROM resume_profile WHERE id=1");
  const jobsQuery = db.prepare("SELECT id,company,role,url,status,created_at AS createdAt,notes FROM applications ORDER BY created_at DESC, id");
  const insertJob = db.prepare("INSERT INTO applications (id,company,role,url,status,created_at,notes) VALUES (?,?,?,?,?,?,?)");
  const saveProfile = db.prepare("INSERT INTO resume_profile (id,json) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json");
  function getSnapshot() {
    return { revision: Number(getRevision.get().value),
      profile: profileQuery.get() ? JSON.parse(profileQuery.get().json) : null,
      jobs: jobsQuery.all() };
  }
  function saveSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") throw new Error("Invalid state.");
    const profile = validateResume(snapshot.profile);
    const jobs = validateJobs(snapshot.jobs);
    const revision = snapshot.revision;
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error("Expected a nonnegative revision.");
    db.exec("BEGIN IMMEDIATE");
    try {
      const current = Number(getRevision.get().value);
      if (current !== revision) {
        const error = new Error("Data changed in another tab. Reload the page to avoid overwriting it.");
        error.code = "STALE_STATE";
        throw error;
      }
      saveProfile.run(JSON.stringify(profile));
      db.exec("DELETE FROM applications");
      for (const job of jobs) insertJob.run(job.id,job.company,job.role,job.url,job.status,job.createdAt,job.notes);
      db.prepare("UPDATE app_meta SET value=? WHERE key='revision'").run(current + 1);
      db.exec("COMMIT");
      return { revision: current + 1 };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  return { getSnapshot, saveSnapshot, close: () => db.close() };
}
