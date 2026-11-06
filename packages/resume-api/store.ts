import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { validateResume } from "../resume/src/resume-schema/validate.ts";

export const DEFAULT_PROFILE_ID = "00000000-0000-4000-8000-000000000001";
export type LocalProfile = { id: string; name: string; createdAt: string };
export type ResumeVersion = { id: string; name: string; createdAt: string };
type JobRecord = { id: string; company: string; role: string; url: string; status: string; createdAt: string; notes: string };
const statuses = new Set(["saved","in_progress","ready_for_review","submitted","interview","rejected"]);
const validId = (id: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("Invalid identifier.");
  return id;
};
function name(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 80) throw new Error("Name must be 1–80 characters.");
  return value.trim();
}
function validateJobs(raw: unknown): JobRecord[] {
  if (!Array.isArray(raw) || raw.length > 5000) throw new Error("Applications must be an array of at most 5000 jobs.");
  const ids = new Set<string>();
  return raw.map((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid job.");
    const row = item as Record<string, unknown>;
    for (const key of ["id","company","role","url","status","createdAt","notes"])
      if (typeof row[key] !== "string") throw new Error("Invalid job field: " + key);
    const job = row as JobRecord;
    if (!validId(job.id) || ids.has(job.id)) throw new Error("Duplicate job identifier.");
    ids.add(job.id);
    if (!statuses.has(job.status)) throw new Error("Invalid job status.");
    if (job.url && !/^https?:\/\//i.test(job.url)) throw new Error("Invalid job URL.");
    if (job.notes.length > 50000 || job.company.length > 500 || job.role.length > 500 || job.url.length > 4000)
      throw new Error("Job field is too long.");
    return job;
  });
}
export function openStore(filePath = process.env.MOYA_DB_PATH || "data/moyaapply.sqlite") {
  const path = filePath === ":memory:" ? filePath : resolve(filePath);
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") { try { chmodSync(path, 0o600); } catch { /* Filesystems differ. */ } }
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  const tableExists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?");
  if (["resume_profile","applications","app_meta"].some(table => tableExists.get(table))) {
    db.close();
    throw new Error("Legacy SQLite schema is unsupported. Back up the existing database and start with a new empty database.");
  }
  db.exec(`CREATE TABLE IF NOT EXISTS local_profiles (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profile_state (
 profile_id TEXT PRIMARY KEY REFERENCES local_profiles(id) ON DELETE CASCADE, revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS profile_resumes (
 id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES local_profiles(id) ON DELETE CASCADE,
 name TEXT NOT NULL, json TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS profile_resumes_owner ON profile_resumes(profile_id,created_at,id);
CREATE TABLE IF NOT EXISTS profile_applications (
 profile_id TEXT NOT NULL REFERENCES local_profiles(id) ON DELETE CASCADE,
 id TEXT NOT NULL, company TEXT NOT NULL, role TEXT NOT NULL, url TEXT NOT NULL,
 status TEXT NOT NULL CHECK (status IN ('saved','in_progress','ready_for_review','submitted','interview','rejected')),
 created_at TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', PRIMARY KEY(profile_id,id)
);`);
  const now = () => new Date().toISOString();
  const insertProfile = db.prepare("INSERT INTO local_profiles (id,name,created_at) VALUES (?,?,?)");
  const insertState = db.prepare("INSERT INTO profile_state (profile_id,revision) VALUES (?,0)");
  const insertResume = db.prepare("INSERT INTO profile_resumes (id,profile_id,name,json,created_at) VALUES (?,?,?,?,?)");
  const selectProfile = db.prepare("SELECT id,name,created_at AS createdAt FROM local_profiles WHERE id=?");
  const listProfileRows = db.prepare("SELECT id,name,created_at AS createdAt FROM local_profiles ORDER BY created_at,id");
  const listResumeRows = db.prepare("SELECT id,name,created_at AS createdAt FROM profile_resumes WHERE profile_id=? ORDER BY created_at,id");
  const selectResume = db.prepare("SELECT id,name,json,created_at AS createdAt FROM profile_resumes WHERE id=? AND profile_id=?");
  const getRevision = db.prepare("SELECT revision FROM profile_state WHERE profile_id=?");
  const getJobs = db.prepare("SELECT id,company,role,url,status,created_at AS createdAt,notes FROM profile_applications WHERE profile_id=? ORDER BY created_at DESC,id");
  const insertJob = db.prepare("INSERT INTO profile_applications (profile_id,id,company,role,url,status,created_at,notes) VALUES (?,?,?,?,?,?,?,?)");
  const deleteJobs = db.prepare("DELETE FROM profile_applications WHERE profile_id=?");
  if (!selectProfile.get(DEFAULT_PROFILE_ID)) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const createdAt = now();
      insertProfile.run(DEFAULT_PROFILE_ID, "Default profile", createdAt);
      insertState.run(DEFAULT_PROFILE_ID);
      insertResume.run(randomUUID(), DEFAULT_PROFILE_ID, "Primary résumé", null, createdAt);
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); db.close(); throw error; }
  }
  function requireProfile(profileId: string): string {
    const id = validId(profileId);
    if (!selectProfile.get(id)) throw new Error("Local profile not found.");
    return id;
  }
  function requireResume(profileId: string, resumeId: string) {
    const row = selectResume.get(validId(resumeId), requireProfile(profileId)) as
      { id: string; name: string; json: string | null; createdAt: string } | undefined;
    if (!row) throw new Error("Résumé version not found for the selected local profile.");
    return row;
  }
  const listProfiles = (): LocalProfile[] => listProfileRows.all() as LocalProfile[];
  function listResumes(profileId: string): ResumeVersion[] {
    return listResumeRows.all(requireProfile(profileId)) as ResumeVersion[];
  }
  function createProfile(value: unknown): LocalProfile {
    const row: LocalProfile = { id: randomUUID(), name: name(value), createdAt: now() };
    db.exec("BEGIN IMMEDIATE");
    try {
      insertProfile.run(row.id, row.name, row.createdAt);
      insertState.run(row.id);
      insertResume.run(randomUUID(), row.id, "Primary résumé", null, row.createdAt);
      db.exec("COMMIT");
      return row;
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  function renameProfile(profileId: string, value: unknown): LocalProfile {
    const id = requireProfile(profileId);
    db.prepare("UPDATE local_profiles SET name=? WHERE id=?").run(name(value), id);
    return selectProfile.get(id) as LocalProfile;
  }
  function deleteProfile(profileId: string) {
    const id = requireProfile(profileId);
    if (id === DEFAULT_PROFILE_ID) throw new Error("Default profile cannot be deleted.");
    db.prepare("DELETE FROM local_profiles WHERE id=?").run(id);
  }
  function createResume(profileId: string, value: unknown, copyId?: string): ResumeVersion {
    const owner = requireProfile(profileId);
    const source = copyId ? requireResume(owner, copyId) : null;
    const row: ResumeVersion = { id: randomUUID(), name: name(value), createdAt: now() };
    insertResume.run(row.id, owner, row.name, source?.json ?? null, row.createdAt);
    return row;
  }
  function renameResume(profileId: string, resumeId: string, value: unknown): ResumeVersion {
    const row = requireResume(profileId, resumeId);
    const next = name(value);
    db.prepare("UPDATE profile_resumes SET name=? WHERE id=? AND profile_id=?").run(next, row.id, profileId);
    return { id: row.id, name: next, createdAt: row.createdAt };
  }
  function deleteResume(profileId: string, resumeId: string) {
    const owner = requireProfile(profileId);
    requireResume(owner, resumeId);
    if (listResumes(owner).length <= 1) throw new Error("Keep at least one résumé version per local profile.");
    db.prepare("DELETE FROM profile_resumes WHERE id=? AND profile_id=?").run(resumeId, owner);
  }
  function getSnapshot(profileId = DEFAULT_PROFILE_ID, resumeId?: string) {
    const owner = requireProfile(profileId);
    const resumes = listResumes(owner);
    const selectedId = resumeId ?? resumes[0]?.id;
    if (!selectedId) throw new Error("No résumé versions exist for this profile.");
    const selected = requireResume(owner, selectedId);
    return {
      revision: (getRevision.get(owner) as { revision: number }).revision,
      profile: selected.json ? JSON.parse(selected.json) : null,
      jobs: getJobs.all(owner) as JobRecord[],
      resumeId: selected.id, resumes,
    };
  }
  function saveSnapshot(snapshot: unknown, profileId = DEFAULT_PROFILE_ID, resumeId?: string) {
    const owner = requireProfile(profileId);
    const id = resumeId ?? listResumes(owner)[0]?.id;
    if (!id) throw new Error("No résumé version selected.");
    requireResume(owner, id);
    if (!snapshot || typeof snapshot !== "object") throw new Error("Invalid state.");
    const state = snapshot as Record<string, unknown>;
    const candidate = state.profile == null ? null : validateResume(state.profile);
    const jobs = validateJobs(state.jobs);
    const revision = state.revision;
    if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0)
      throw new Error("Expected a nonnegative revision.");
    db.exec("BEGIN IMMEDIATE");
    try {
      const current = (getRevision.get(owner) as { revision: number }).revision;
      if (current !== revision) {
        const error = new Error("Data changed in another tab. Reload to avoid overwriting it.") as Error & { code?: string };
        error.code = "STALE_STATE";
        throw error;
      }
      deleteJobs.run(owner);
      for (const job of jobs) insertJob.run(owner, job.id,job.company,job.role,job.url,job.status,job.createdAt,job.notes);
      db.prepare("UPDATE profile_resumes SET json=? WHERE profile_id=? AND id=?").run(candidate ? JSON.stringify(candidate) : null, owner, id);
      db.prepare("UPDATE profile_state SET revision=? WHERE profile_id=?").run(current + 1, owner);
      db.exec("COMMIT");
      return { revision: current + 1 };
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  return { listProfiles, createProfile, renameProfile, deleteProfile, listResumes, createResume, renameResume, deleteResume, getSnapshot, saveSnapshot, close: () => db.close() };
}
