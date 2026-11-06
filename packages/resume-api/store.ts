import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { validateResume } from "../resume/src/resume-schema/validate.ts";

type JobRecord = { id: string; company: string; role: string; url: string; status: string; createdAt: string; notes: string };
const STATUSES = new Set<string>(["saved","in_progress","ready_for_review","submitted","interview","rejected"]);
function validateJobs(input: unknown): JobRecord[] {
  if (!Array.isArray(input) || input.length > 5000) throw new Error("Applications must be an array of at most 5000 jobs.");
  const ids = new Set<string>();
  return input.map((raw: unknown) => {
    const job = raw as Record<string, unknown>;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid job record.");
    for (const key of ["id","company","role","url","status","createdAt","notes"])
      if (typeof job[key] !== "string") throw new Error("Invalid job field: " + key);
    const validated = job as JobRecord;
    if (!/^[0-9a-f-]{36}$/i.test(validated.id) || ids.has(validated.id)) throw new Error("Duplicate or invalid job ID.");
    ids.add(validated.id);
    if (!STATUSES.has(validated.status)) throw new Error("Invalid application status.");
    if (validated.url && !/^https?:\/\//i.test(validated.url)) throw new Error("Invalid job URL.");
    if (validated.notes.length > 50000 || validated.company.length > 500 || validated.role.length > 500 || validated.url.length > 4000)
      throw new Error("Application data exceeds field limits.");
    return validated;
  });
}
export function openStore(filePath: string = process.env.MOYA_DB_PATH || "data/moyaapply.sqlite") {
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
    const revision = getRevision.get() as { value: number } | undefined;
    const profile = profileQuery.get() as { json: string } | undefined;
    return { revision: Number(revision?.value),
      profile: profile ? JSON.parse(profile.json) : null,
      jobs: jobsQuery.all() as JobRecord[] };
  }
  function saveSnapshot(snapshot: unknown) {
    if (!snapshot || typeof snapshot !== "object") throw new Error("Invalid state.");
    const state = snapshot as Record<string, unknown>;
    const profile = validateResume(state.profile);
    const jobs = validateJobs(state.jobs);
    const revision = state.revision;
    if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) throw new Error("Expected a nonnegative revision.");
    db.exec("BEGIN IMMEDIATE");
    try {
      const current = Number((getRevision.get() as { value: number } | undefined)?.value);
      if (current !== revision) {
        const error = new Error("Data changed in another tab. Reload the page to avoid overwriting it.") as Error & { code?: string };
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
