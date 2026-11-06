import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { validateResume } from "../resume/src/resume-schema/validate.ts";

export const DEFAULT_PROFILE_ID = "00000000-0000-4000-8000-000000000001";
export type LocalProfile = { id: string; name: string; createdAt: string };
type JobRecord = { id: string; company: string; role: string; url: string; status: string; createdAt: string; notes: string };
const STATUSES = new Set(["saved", "in_progress", "ready_for_review", "submitted", "interview", "rejected"]);
const PROFILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validateProfileId(id: string): string {
  if (!PROFILE_ID_PATTERN.test(id)) throw new Error("Invalid profile ID.");
  return id;
}
function validateName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 80)
    throw new Error("Profile name must contain 1 to 80 characters.");
  return value.trim();
}
function validateJobs(input: unknown): JobRecord[] {
  if (!Array.isArray(input) || input.length > 5000) throw new Error("Applications must be an array of at most 5000 jobs.");
  const ids = new Set<string>();
  return input.map((raw: unknown) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid job record.");
    const job = raw as Record<string, unknown>;
    for (const key of ["id", "company", "role", "url", "status", "createdAt", "notes"])
      if (typeof job[key] !== "string") throw new Error("Invalid job field: " + key);
    const validated = job as JobRecord;
    if (!PROFILE_ID_PATTERN.test(validated.id) || ids.has(validated.id)) throw new Error("Duplicate or invalid job ID.");
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
  // Keep the legacy tables in place for a nondestructive migration of existing data.
  db.exec(`CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS resume_profile (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS applications (
 id TEXT PRIMARY KEY, company TEXT NOT NULL, role TEXT NOT NULL, url TEXT NOT NULL,
 status TEXT NOT NULL CHECK (status IN ('saved','in_progress','ready_for_review','submitted','interview','rejected')),
 created_at TEXT NOT NULL, notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS local_profiles (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profile_state (
 profile_id TEXT PRIMARY KEY REFERENCES local_profiles(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL DEFAULT 0,
 json TEXT
);
CREATE TABLE IF NOT EXISTS profile_applications (
 profile_id TEXT NOT NULL REFERENCES local_profiles(id) ON DELETE CASCADE,
 id TEXT NOT NULL, company TEXT NOT NULL, role TEXT NOT NULL, url TEXT NOT NULL,
 status TEXT NOT NULL CHECK (status IN ('saved','in_progress','ready_for_review','submitted','interview','rejected')),
 created_at TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(profile_id, id)
);`);
  db.prepare("INSERT OR IGNORE INTO app_meta (key,value) VALUES ('revision',0)").run();
  const legacyRevision = db.prepare("SELECT value FROM app_meta WHERE key='revision'");
  const legacyProfile = db.prepare("SELECT json FROM resume_profile WHERE id=1");
  const legacyJobs = db.prepare("SELECT id,company,role,url,status,created_at AS createdAt,notes FROM applications ORDER BY created_at DESC, id");
  const insertProfile = db.prepare("INSERT INTO local_profiles (id,name,created_at) VALUES (?,?,?)");
  const insertState = db.prepare("INSERT INTO profile_state (profile_id,revision,json) VALUES (?,?,?)");
  const selectProfile = db.prepare("SELECT id,name,created_at AS createdAt FROM local_profiles WHERE id=?");
  const listProfileRows = db.prepare("SELECT id,name,created_at AS createdAt FROM local_profiles ORDER BY created_at, id");
  const stateQuery = db.prepare("SELECT revision,json FROM profile_state WHERE profile_id=?");
  const jobsQuery = db.prepare("SELECT id,company,role,url,status,created_at AS createdAt,notes FROM profile_applications WHERE profile_id=? ORDER BY created_at DESC, id");
  const insertJob = db.prepare("INSERT INTO profile_applications (profile_id,id,company,role,url,status,created_at,notes) VALUES (?,?,?,?,?,?,?,?)");
  const deleteJobs = db.prepare("DELETE FROM profile_applications WHERE profile_id=?");
  const saveProfileState = db.prepare("UPDATE profile_state SET revision=?,json=? WHERE profile_id=?");
  const now = () => new Date().toISOString();
  // A one-time migration preserves the exact original résumé, jobs and revision.
  db.exec("BEGIN IMMEDIATE");
  try {
    if (!selectProfile.get(DEFAULT_PROFILE_ID)) {
      insertProfile.run(DEFAULT_PROFILE_ID, "Default profile", now());
      const prior = legacyProfile.get() as { json: string } | undefined;
      const revision = Number((legacyRevision.get() as { value: number } | undefined)?.value ?? 0);
      insertState.run(DEFAULT_PROFILE_ID, revision, prior?.json ?? null);
      for (const job of legacyJobs.all() as JobRecord[])
        insertJob.run(DEFAULT_PROFILE_ID, job.id, job.company, job.role, job.url, job.status, job.createdAt, job.notes);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    db.close();
    throw error;
  }
  function requireProfile(profileId: string): string {
    const id = validateProfileId(profileId);
    if (!selectProfile.get(id)) throw new Error("Profile not found.");
    return id;
  }
  function listProfiles(): LocalProfile[] {
    return listProfileRows.all() as LocalProfile[];
  }
  function createProfile(name: unknown): LocalProfile {
    const profile: LocalProfile = { id: randomUUID(), name: validateName(name), createdAt: now() };
    db.exec("BEGIN IMMEDIATE");
    try {
      insertProfile.run(profile.id, profile.name, profile.createdAt);
      insertState.run(profile.id, 0, null);
      db.exec("COMMIT");
      return profile;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  function renameProfile(profileId: string, name: unknown): LocalProfile {
    const id = requireProfile(profileId);
    db.prepare("UPDATE local_profiles SET name=? WHERE id=?").run(validateName(name), id);
    return selectProfile.get(id) as LocalProfile;
  }
  function deleteProfile(profileId: string): void {
    const id = requireProfile(profileId);
    if (id === DEFAULT_PROFILE_ID) throw new Error("The default profile cannot be deleted.");
    db.prepare("DELETE FROM local_profiles WHERE id=?").run(id);
  }
  function getSnapshot(profileId = DEFAULT_PROFILE_ID) {
    const id = requireProfile(profileId);
    const row = stateQuery.get(id) as { revision: number; json: string | null };
    return {
      revision: row.revision,
      profile: row.json ? JSON.parse(row.json) : null,
      jobs: jobsQuery.all(id) as JobRecord[],
    };
  }
  function saveSnapshot(snapshot: unknown, profileId = DEFAULT_PROFILE_ID) {
    const id = requireProfile(profileId);
    if (!snapshot || typeof snapshot !== "object") throw new Error("Invalid state.");
    const state = snapshot as Record<string, unknown>;
    // A new local profile can be saved before its résumé has been completed.
    const profile = state.profile == null ? null : validateResume(state.profile);
    const jobs = validateJobs(state.jobs);
    const revision = state.revision;
    if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0)
      throw new Error("Expected a nonnegative revision.");
    db.exec("BEGIN IMMEDIATE");
    try {
      const current = (stateQuery.get(id) as { revision: number }).revision;
      if (current !== revision) {
        const error = new Error("Data changed in another tab. Reload the page to avoid overwriting it.") as Error & { code?: string };
        error.code = "STALE_STATE";
        throw error;
      }
      deleteJobs.run(id);
      for (const job of jobs)
        insertJob.run(id, job.id, job.company, job.role, job.url, job.status, job.createdAt, job.notes);
      saveProfileState.run(current + 1, profile == null ? null : JSON.stringify(profile), id);
      db.exec("COMMIT");
      return { revision: current + 1 };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  return { listProfiles, createProfile, renameProfile, deleteProfile, getSnapshot, saveSnapshot, close: () => db.close() };
}
