import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { validateResume } from "../resume/src/resume-schema/validate.ts";
import type { CandidateProfile } from "../resume/src/types.ts";

export const DEFAULT_PROFILE_ID = "00000000-0000-4000-8000-000000000001";
export type LocalProfile = { id: string; name: string; createdAt: string };
export type ResumeVersion = { id: string; name: string; contactId: string | null; createdAt: string; updatedAt: string };
export type ProfileContact = CandidateProfile["contact"] & {
  id: string; profileId: string; name: string; isDefault: boolean;
};
const CONTACT_KEYS = ["firstName","lastName","email","phone","location","linkedIn","github","website"] as const;
function validateContact(raw: unknown): CandidateProfile["contact"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid contact information.");
  const value = raw as Record<string,unknown>;
  if (Object.keys(value).some(key => !CONTACT_KEYS.includes(key as typeof CONTACT_KEYS[number])) ||
      CONTACT_KEYS.some(key => typeof value[key] !== "string"))
    throw new Error("Invalid contact information.");
  return value as CandidateProfile["contact"];
}
const isUsableContact = (c: CandidateProfile["contact"]) =>
  Boolean(c.firstName.trim() && c.lastName.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim()));
const emptyContact = (): CandidateProfile["contact"] => ({
  firstName: "", lastName: "", email: "", phone: "", location: "",
  linkedIn: "", github: "", website: "",
});
export type EmployerAccount = {
  provider: string;
  employerKey: string;
  employerName: string;
  host: string;
  status: "setup_required" | "ready";
  updatedAt: string;
};
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
  // Deliberately new schema: no legacy tables, migrations, or compatibility paths.
  db.exec(`CREATE TABLE IF NOT EXISTS profiles (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL
);
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
 UNIQUE(profile_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_default_contact_per_profile
 ON profile_contact(profile_id) WHERE is_default=1;
CREATE TABLE IF NOT EXISTS profile_state (
 profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS resumes (
 id TEXT PRIMARY KEY,
 profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 contact_id TEXT,
 name TEXT NOT NULL,
 content_json TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 FOREIGN KEY(profile_id, contact_id) REFERENCES profile_contact(profile_id,id)
);
CREATE INDEX IF NOT EXISTS resumes_owner ON resumes(profile_id,created_at,id);
CREATE TABLE IF NOT EXISTS employer_accounts (
 profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 provider TEXT NOT NULL, employer_key TEXT NOT NULL,
 employer_name TEXT NOT NULL, host TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('setup_required','ready')),
 updated_at TEXT NOT NULL, PRIMARY KEY(profile_id,provider,employer_key)
);
CREATE TABLE IF NOT EXISTS applications (
 profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 id TEXT NOT NULL, resume_id TEXT,
 company TEXT NOT NULL, role TEXT NOT NULL, url TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('saved','in_progress','ready_for_review','submitted','interview','rejected')),
 created_at TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(profile_id,id),
 FOREIGN KEY(resume_id) REFERENCES resumes(id) ON DELETE SET NULL
);
`);
  const now = () => new Date().toISOString();
  const insertProfile = db.prepare("INSERT INTO profiles(id,name,created_at) VALUES (?,?,?)");
  const insertState = db.prepare("INSERT INTO profile_state(profile_id,revision) VALUES (?,0)");
  const selectProfile = db.prepare("SELECT id,name,created_at AS createdAt FROM profiles WHERE id=?");
  const listProfileRows = db.prepare("SELECT id,name,created_at AS createdAt FROM profiles ORDER BY created_at,id");
  const insertContact = db.prepare(`INSERT INTO profile_contact
 (id,profile_id,name,is_default,first_name,last_name,email,phone,location,linkedin,github,website)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const updateContact = db.prepare(`UPDATE profile_contact
 SET first_name=?,last_name=?,email=?,phone=?,location=?,linkedin=?,github=?,website=?
 WHERE profile_id=? AND id=?`);
  const selectContact = db.prepare(`SELECT id,profile_id AS profileId,name,is_default AS isDefault,
 first_name AS firstName,last_name AS lastName,email,phone,location,linkedin AS linkedIn,github,website
 FROM profile_contact WHERE profile_id=? AND id=?`);
  const listContactRows = db.prepare(`SELECT id,profile_id AS profileId,name,is_default AS isDefault,
 first_name AS firstName,last_name AS lastName,email,phone,location,linkedin AS linkedIn,github,website
 FROM profile_contact WHERE profile_id=? ORDER BY is_default DESC,name,id`);
  const getDefaultContact = db.prepare("SELECT id FROM profile_contact WHERE profile_id=? AND is_default=1");
  const insertResume = db.prepare("INSERT INTO resumes(id,profile_id,contact_id,name,content_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)");
  const listResumeRows = db.prepare("SELECT id,name,contact_id AS contactId,created_at AS createdAt,updated_at AS updatedAt FROM resumes WHERE profile_id=? ORDER BY created_at,id");
  const selectResume = db.prepare("SELECT id,name,contact_id AS contactId,content_json AS json,created_at AS createdAt,updated_at AS updatedAt FROM resumes WHERE id=? AND profile_id=?");
  const getRevision = db.prepare("SELECT revision FROM profile_state WHERE profile_id=?");
  const getJobs = db.prepare("SELECT id,company,role,url,status,created_at AS createdAt,notes,resume_id AS resumeId FROM applications WHERE profile_id=? ORDER BY created_at DESC,id");
  const insertJob = db.prepare("INSERT INTO applications(profile_id,id,resume_id,company,role,url,status,created_at,notes) VALUES (?,?,?,?,?,?,?,?,?)");
  const deleteJobs = db.prepare("DELETE FROM applications WHERE profile_id=?");
  function contactValues(contact: CandidateProfile["contact"]) {
    return [contact.firstName,contact.lastName,contact.email,contact.phone,contact.location,contact.linkedIn,contact.github,contact.website] as const;
  }
  function addContact(profileId: string, value: CandidateProfile["contact"], label: string, isDefault = false) {
    const id = randomUUID();
    insertContact.run(id,profileId,name(label),isDefault ? 1 : 0,...contactValues(value));
    return id;
  }
  if (!selectProfile.get(DEFAULT_PROFILE_ID)) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const createdAt = now();
      insertProfile.run(DEFAULT_PROFILE_ID, "Default profile", createdAt);
      insertState.run(DEFAULT_PROFILE_ID);
      insertResume.run(randomUUID(), DEFAULT_PROFILE_ID, null, "Primary resume", null, createdAt, createdAt);
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
      { id: string; name: string; contactId: string | null; json: string | null; createdAt: string; updatedAt: string } | undefined;
    if (!row) throw new Error("Resume version not found for the selected local profile.");
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
      insertResume.run(randomUUID(), row.id, null, "Primary resume", null, row.createdAt, row.createdAt);
      db.exec("COMMIT");
      return row;
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  function renameProfile(profileId: string, value: unknown): LocalProfile {
    const id = requireProfile(profileId);
    db.prepare("UPDATE profiles SET name=? WHERE id=?").run(name(value), id);
    return selectProfile.get(id) as LocalProfile;
  }
  function deleteProfile(profileId: string) {
    const id = requireProfile(profileId);
    if (id === DEFAULT_PROFILE_ID) throw new Error("Default profile cannot be deleted.");
    db.prepare("DELETE FROM profiles WHERE id=?").run(id);
  }
  function listContacts(profileId: string): ProfileContact[] {
    return listContactRows.all(requireProfile(profileId)) as unknown as ProfileContact[];
  }
  function createContact(profileId: string, contact: unknown, label: unknown): ProfileContact {
    const owner = requireProfile(profileId);
    const valid = validateContact(contact);
    if (!isUsableContact(valid)) throw new Error("Contact requires first name, last name, and a valid email.");
    const id = addContact(owner,valid,name(label),!getDefaultContact.get(owner));
    return selectContact.get(owner,id) as unknown as ProfileContact;
  }
  function updateContactRecord(profileId: string, contactId: string, contact: unknown): ProfileContact {
    const owner = requireProfile(profileId);
    if (!selectContact.get(owner,validId(contactId))) throw new Error("Contact not found for profile.");
    updateContact.run(...contactValues(validateContact(contact)),owner,contactId);
    return selectContact.get(owner,contactId) as unknown as ProfileContact;
  }
  function setDefaultContact(profileId: string, contactId: string): ProfileContact {
    const owner = requireProfile(profileId);
    if (!selectContact.get(owner,validId(contactId))) throw new Error("Contact not found for profile.");
    const chosen = selectContact.get(owner,contactId) as unknown as ProfileContact;
    if (!isUsableContact(chosen)) throw new Error("Default contact must have a first name, last name, and valid email.");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE profile_contact SET is_default=0 WHERE profile_id=?").run(owner);
      db.prepare("UPDATE profile_contact SET is_default=1 WHERE profile_id=? AND id=?").run(owner,contactId);
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    return selectContact.get(owner,contactId) as unknown as ProfileContact;
  }
  function resolveImportContact(
    profileId: string,
    resumeId: string,
    incoming: unknown,
    choices: unknown,
  ) {
    const owner = requireProfile(profileId);
    const resume = requireResume(owner,resumeId);
    const parsed = validateContact(incoming);
    if (!choices || typeof choices !== "object" || Array.isArray(choices))
      throw new Error("Contact choices are required.");
    const decisions = choices as Record<string,unknown>;
    if (Object.entries(decisions).some(([key,value]) =>
      !CONTACT_KEYS.includes(key as typeof CONTACT_KEYS[number]) ||
      !["resume","shared","keep"].includes(String(value))))
      throw new Error("Invalid contact import choice.");
    const current = resume.contactId
      ? selectContact.get(owner,resume.contactId) as unknown as ProfileContact
      : null;
    const shared = current
      ? Object.fromEntries(CONTACT_KEYS.map(key => [key,current[key]])) as CandidateProfile["contact"]
      : emptyContact();
    const tailored = {...shared};
    let hasResumeDifference = false;
    for (const key of CONTACT_KEYS) {
      const value = parsed[key].trim();
      if (!value || value === shared[key]) continue;
      const choice = decisions[key] ?? "resume";
      if (choice === "shared") shared[key] = value;
      if (choice === "resume") { tailored[key] = value; hasResumeDifference = true; }
    }
    // Shared updates also flow into newly created contact records unless a
    // resume-specific choice explicitly overrides that field.
    for (const key of CONTACT_KEYS)
      if (decisions[key] !== "resume") tailored[key] = shared[key];
    db.exec("BEGIN IMMEDIATE");
    try {
      if (current && CONTACT_KEYS.some(key => shared[key] !== current[key]))
        updateContact.run(...contactValues(shared),owner,current.id);
      let contactId = current?.id ?? null;
      if (hasResumeDifference || !current) {
        if (isUsableContact(tailored)) {
          const duplicate = listContacts(owner).find(item => CONTACT_KEYS.every(key => item[key] === tailored[key]));
          contactId = duplicate?.id ?? addContact(owner,tailored,"Imported contact",!getDefaultContact.get(owner));
        }
      }
      db.prepare("UPDATE resumes SET contact_id=?,updated_at=? WHERE profile_id=? AND id=?")
        .run(contactId,now(),owner,resume.id);
      db.exec("COMMIT");
      return {contactId,contact:tailored,contacts:listContacts(owner)};
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  function createResume(profileId: string, value: unknown, copyId?: string): ResumeVersion {
    const owner = requireProfile(profileId);
    const source = copyId ? requireResume(owner,copyId) : null;
    const defaultId = (getDefaultContact.get(owner) as {id:string}|undefined)?.id;
    const row: ResumeVersion = { id: randomUUID(), name: name(value),
      contactId: source?.contactId ?? defaultId ?? null, createdAt: now(), updatedAt: now() };
    insertResume.run(row.id,owner,row.contactId,row.name,source?.json ?? null,row.createdAt,row.updatedAt);
    return row;
  }
  function renameResume(profileId: string, resumeId: string, value: unknown): ResumeVersion {
    const row = requireResume(profileId,resumeId);
    const next = name(value), updatedAt = now();
    db.prepare("UPDATE resumes SET name=?,updated_at=? WHERE profile_id=? AND id=?").run(next,updatedAt,profileId,row.id);
    return { id: row.id, contactId: row.contactId, name: next, createdAt: row.createdAt, updatedAt };
  }
  function deleteResume(profileId: string, resumeId: string) {
    const owner = requireProfile(profileId);
    requireResume(owner,resumeId);
    if (listResumes(owner).length <= 1) throw new Error("Keep at least one resume per profile.");
    db.prepare("DELETE FROM resumes WHERE id=? AND profile_id=?").run(resumeId,owner);
  }
  const getEmployerAccount = db.prepare("SELECT provider,employer_key AS employerKey,employer_name AS employerName,host,status,updated_at AS updatedAt FROM employer_accounts WHERE profile_id=? AND provider=? AND employer_key=?");
  const listEmployerAccounts = db.prepare("SELECT provider,employer_key AS employerKey,employer_name AS employerName,host,status,updated_at AS updatedAt FROM employer_accounts WHERE profile_id=? ORDER BY employer_name,provider,employer_key");
  const insertEmployerAccount = db.prepare("INSERT INTO employer_accounts (profile_id,provider,employer_key,employer_name,host,status,updated_at) VALUES (?,?,?,?,?,'setup_required',?) ON CONFLICT(profile_id,provider,employer_key) DO UPDATE SET employer_name=excluded.employer_name");
  const updateEmployerAccount = db.prepare("UPDATE employer_accounts SET status=?,updated_at=? WHERE profile_id=? AND provider=? AND employer_key=?");
  function getOrCreateEmployerAccount(profileId: string, identity: { provider: string; employerKey: string; employerName: string; host: string }): EmployerAccount {
    const owner = requireProfile(profileId);
    if (!/^[a-z-]+$/.test(identity.provider) || !identity.employerKey || identity.employerKey.length > 250 ||
        !identity.employerName?.trim() || identity.employerName.length > 200 || !identity.host)
      throw new Error("Invalid employer account details.");
    insertEmployerAccount.run(owner,identity.provider,identity.employerKey,identity.employerName,identity.host,now());
    return getEmployerAccount.get(owner,identity.provider,identity.employerKey) as EmployerAccount;
  }
  function listAccounts(profileId: string): EmployerAccount[] {
    return listEmployerAccounts.all(requireProfile(profileId)) as EmployerAccount[];
  }
  function setEmployerAccountStatus(profileId: string, provider: string, employerKey: string, status: "setup_required" | "ready"): EmployerAccount {
    const owner = requireProfile(profileId);
    if (!["setup_required","ready"].includes(status)) throw new Error("Invalid employer account status.");
    if (!(getEmployerAccount.get(owner,provider,employerKey))) throw new Error("Employer account not found.");
    updateEmployerAccount.run(status,now(),owner,provider,employerKey);
    return getEmployerAccount.get(owner,provider,employerKey) as EmployerAccount;
  }
  function getSnapshot(profileId = DEFAULT_PROFILE_ID, resumeId?: string) {
    const owner = requireProfile(profileId);
    const resumes = listResumes(owner);
    const selectedId = resumeId ?? resumes[0]?.id;
    if (!selectedId) throw new Error("No resume exists for profile.");
    const selected = requireResume(owner,selectedId);
    const contacts = listContacts(owner);
    const selectedContact = contacts.find(item => item.id === selected.contactId);
    const defaultContact = contacts.find(item => item.isDefault);
    if (selected.contactId && !selectedContact) throw new Error("Selected resume contact not found.");
    const contact = selectedContact
      ? Object.fromEntries(CONTACT_KEYS.map(key => [key,selectedContact[key]])) as CandidateProfile["contact"]
      : null;
    const document = selected.json ? JSON.parse(selected.json) as CandidateProfile : null;
    return {
      revision: (getRevision.get(owner) as {revision:number}).revision,
      contact,
      contactId: selected.contactId,
      defaultContactId: defaultContact?.id ?? null,
      contacts,
      profile: document ? { ...document, contact: contact ?? document.contact } : null,
      jobs: (getJobs.all(owner) as (JobRecord & {resumeId:string|null})[]).map(({resumeId,...job}) => resumeId ? {...job,resumeId} : job),
      resumeId: selected.id, resumes,
    };
  }
  function saveSnapshot(snapshot: unknown, profileId = DEFAULT_PROFILE_ID, resumeId?: string) {
    const owner = requireProfile(profileId);
    const id = resumeId ?? listResumes(owner)[0]?.id;
    if (!id) throw new Error("No resume selected.");
    const selected = requireResume(owner,id);
    if (!snapshot || typeof snapshot !== "object") throw new Error("Invalid state.");
    const state = snapshot as Record<string,unknown>;
    const candidate = state.profile == null ? null : validateResume(state.profile);
    const jobs = validateJobs(state.jobs);
    const contactId = state.contactId == null || state.contactId === ""
      ? null : validId(String(state.contactId));
    if (contactId && !selectContact.get(owner,contactId))
      throw new Error("Contact does not belong to selected profile.");
    const contact = state.contact == null ? candidate?.contact ?? null : validateContact(state.contact);
    if (contact && candidate && CONTACT_KEYS.some(key => contact[key] !== candidate.contact[key]))
      throw new Error("Resume contact must match its selected contact record.");
    const revision = state.revision;
    if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0)
      throw new Error("Expected a nonnegative revision.");
    db.exec("BEGIN IMMEDIATE");
    try {
      const current = (getRevision.get(owner) as {revision:number}).revision;
      if (current !== revision) {
        const error = new Error("Data changed in another tab. Reload to avoid overwriting it.") as Error & {code?:string};
        error.code = "STALE_STATE";
        throw error;
      }
      if (contact && contactId) updateContact.run(...contactValues(contact),owner,contactId);
      // Draft resumes retain their incomplete contact in their own content JSON.
      // Linked resumes derive contact exclusively from their selected contact record.
      const content = candidate ? JSON.stringify(contactId
        ? {...candidate,contact:emptyContact()} : candidate) : null;
      db.prepare("UPDATE resumes SET contact_id=?,content_json=?,updated_at=? WHERE profile_id=? AND id=?")
        .run(contactId,content,now(),owner,id);
      deleteJobs.run(owner);
      for (const job of jobs) {
        const resume = job as JobRecord & {resumeId?:string|null};
        const jobResumeId = resume.resumeId ?? null;
        if (jobResumeId) requireResume(owner,jobResumeId);
        insertJob.run(owner,job.id,jobResumeId,job.company,job.role,job.url,job.status,job.createdAt,job.notes);
      }
      db.prepare("UPDATE profile_state SET revision=? WHERE profile_id=?").run(current+1,owner);
      db.exec("COMMIT");
      return { revision: current+1 };
    } catch(error) { db.exec("ROLLBACK"); throw error; }
  }
  return { listProfiles, createProfile, renameProfile, deleteProfile, listContacts, createContact, updateContactRecord, setDefaultContact, resolveImportContact, listResumes, createResume, renameResume, deleteResume, getOrCreateEmployerAccount, listAccounts, setEmployerAccountStatus, getSnapshot, saveSnapshot, close: () => db.close() };
}
