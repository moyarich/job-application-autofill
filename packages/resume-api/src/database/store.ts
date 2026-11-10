import { reusableAnswer } from "../../../job-sites/screening-policy.ts";
import { openConnection } from "./connection.ts";
import { initializeDatabase } from "./schema.ts";
import { createProfilesStatements } from "./repositories/profiles.ts";
import { createContactsStatements } from "./repositories/contacts.ts";
import { createResumesStatements } from "./repositories/resumes.ts";
import { createApplicationsStatements } from "./repositories/applications.ts";
import { createEmployerAccountsStatements } from "./repositories/employer-accounts.ts";
import { randomUUID } from "node:crypto";
import {
  OPTIONAL_CONTACT_FIELDS,
  validateResume,
} from "../../../resume/src/resume-schema/validate.ts";
import type { CandidateProfile } from "../../../resume/src/types.ts";

export const DEFAULT_PROFILE_ID = "00000000-0000-4000-8000-000000000001";
export type LocalProfile = { id: string; name: string; createdAt: string };
export type ResumeVersion = {
  id: string;
  name: string;
  contactId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type ProfileContact = CandidateProfile["contact"] & {
  id: string;
  profileId: string;
  name: string;
  isDefault: boolean;
};
const REQUIRED_CONTACT_KEYS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "location",
  "linkedIn",
  "github",
  "website",
] as const;
const CONTACT_KEYS = [
  ...REQUIRED_CONTACT_KEYS,
  ...OPTIONAL_CONTACT_FIELDS,
] as const;
function validateContact(raw: unknown): CandidateProfile["contact"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Invalid contact information.");
  const value = raw as Record<string, unknown>;
  if (
    Object.keys(value).some(
      (key) => !CONTACT_KEYS.includes(key as (typeof CONTACT_KEYS)[number]),
    ) ||
    REQUIRED_CONTACT_KEYS.some((key) => typeof value[key] !== "string") ||
    OPTIONAL_CONTACT_FIELDS.some(
      (key) => key in value && typeof value[key] !== "string",
    )
  )
    throw new Error("Invalid contact information.");
  return value as CandidateProfile["contact"];
}
const isUsableContact = (c: CandidateProfile["contact"]) =>
  Boolean(
    c.firstName.trim() &&
    c.lastName.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim()),
  );
const emptyContact = (): CandidateProfile["contact"] => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  location: "",
  linkedIn: "",
  github: "",
  website: "",
});
export type EmployerAccount = {
  provider: string;
  employerKey: string;
  employerName: string;
  host: string;
  status: "setup_required" | "ready";
  updatedAt: string;
};
type JobRecord = {
  id: string;
  company: string;
  role: string;
  url: string;
  status: string;
  createdAt: string;
  notes: string;
  resumeId?: string | null;
  accountAction?: "signup" | "login";
  details?: Record<string, string>;
};
const statuses = new Set([
  "saved",
  "in_progress",
  "ready_for_review",
  "submitted",
  "interview",
  "rejected",
]);
const validId = (id: string) => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new Error("Invalid identifier.");
  return id;
};
function name(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 80)
    throw new Error("Name must be 1–80 characters.");
  return value.trim();
}
function validateJobs(raw: unknown): JobRecord[] {
  if (!Array.isArray(raw) || raw.length > 5000)
    throw new Error("Applications must be an array of at most 5000 jobs.");
  const ids = new Set<string>();
  return raw.map((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error("Invalid job.");
    const row = item as Record<string, unknown>;
    for (const key of [
      "id",
      "company",
      "role",
      "url",
      "status",
      "createdAt",
      "notes",
    ])
      if (typeof row[key] !== "string")
        throw new Error("Invalid job field: " + key);
    if (
      "resumeId" in row &&
      row.resumeId != null &&
      (typeof row.resumeId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          row.resumeId,
        ))
    )
      throw new Error("Invalid associated resume ID.");
    if (
      row.accountAction !== undefined &&
      row.accountAction !== "signup" &&
      row.accountAction !== "login"
    )
      throw new Error("Invalid account action.");
    if (
      Object.keys(row).some(
        (key) =>
          ![
            "id",
            "company",
            "role",
            "url",
            "status",
            "createdAt",
            "notes",
            "resumeId",
            "accountAction",
            "details",
          ].includes(key),
      )
    )
      throw new Error("Invalid job field.");
    if (row.details !== undefined) {
      if (
        !row.details ||
        typeof row.details !== "object" ||
        Array.isArray(row.details)
      )
        throw new Error("Invalid job details.");
      for (const [key, value] of Object.entries(row.details)) {
        if (
          ![
            "location",
            "employmentType",
            "requisitionId",
            "description",
            "postingUrl",
            "salary",
          ].includes(key) ||
          typeof value !== "string" ||
          value.length >
            (key === "description" ? 30000 : key === "postingUrl" ? 4000 : 500)
        )
          throw new Error("Invalid job details.");
      }
    }
    const job = row as JobRecord;
    if (!validId(job.id) || ids.has(job.id))
      throw new Error("Duplicate job identifier.");
    ids.add(job.id);
    if (!statuses.has(job.status)) throw new Error("Invalid job status.");
    if (job.url && !/^https?:\/\//i.test(job.url))
      throw new Error("Invalid job URL.");
    if (
      job.notes.length > 50000 ||
      job.company.length > 500 ||
      job.role.length > 500 ||
      job.url.length > 4000
    )
      throw new Error("Job field is too long.");
    return job;
  });
}
export function openStore(
  filePath = process.env.MOYA_DB_PATH || "data/job_application_autofill.sqlite",
) {
  const db = openConnection(filePath);
  initializeDatabase(db);
  function decodeContact(raw: unknown): ProfileContact | undefined {
    if (!raw) return undefined;
    const { extraJson, ...contact } = raw as Record<string, unknown>;
    const extra = JSON.parse(String(extraJson || "{}"));
    return {
      ...contact,
      ...Object.fromEntries(
        OPTIONAL_CONTACT_FIELDS.filter(
          (key) => typeof extra[key] === "string" && extra[key],
        ).map((key) => [key, extra[key]]),
      ),
    } as ProfileContact;
  }
  const now = () => new Date().toISOString();
  const { insertProfile, selectProfile, listProfileRows } =
    createProfilesStatements(db);
  const {
    insertContact,
    updateContact,
    selectContact,
    listContactRows,
    getDefaultContact,
  } = createContactsStatements(db);
  const { insertResume, listResumeRows, selectResume } =
    createResumesStatements(db);
  const { getJobs, getJobRevision } = createApplicationsStatements(db);
  function contactValues(contact: CandidateProfile["contact"]) {
    return [
      ...REQUIRED_CONTACT_KEYS.map((key) => contact[key]),
      JSON.stringify(
        Object.fromEntries(
          OPTIONAL_CONTACT_FIELDS.filter(
            (key) => contact[key] !== undefined,
          ).map((key) => [key, contact[key]]),
        ),
      ),
    ];
  }
  function addContact(
    profileId: string,
    value: CandidateProfile["contact"],
    label: string,
    isDefault = false,
  ) {
    const id = randomUUID();
    insertContact.run(
      id,
      profileId,
      name(label),
      isDefault ? 1 : 0,
      ...contactValues(value),
    );
    return id;
  }
  if (!selectProfile.get(DEFAULT_PROFILE_ID)) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const createdAt = now();
      insertProfile.run(DEFAULT_PROFILE_ID, "Default profile", createdAt);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }
  function requireProfile(profileId: string): string {
    const id = validId(profileId);
    if (!selectProfile.get(id)) throw new Error("Local profile not found.");
    return id;
  }
  function requireResume(profileId: string, resumeId: string) {
    const row = selectResume.get(
      validId(resumeId),
      requireProfile(profileId),
    ) as
      | {
          id: string;
          name: string;
          contactId: string | null;
          json: string | null;
          createdAt: string;
          updatedAt: string;
          revision: number;
        }
      | undefined;
    if (!row)
      throw new Error(
        "Resume version not found for the selected local profile.",
      );
    return row;
  }
  const listProfiles = (): LocalProfile[] =>
    listProfileRows.all() as LocalProfile[];
  function listResumes(profileId: string): ResumeVersion[] {
    return listResumeRows.all(requireProfile(profileId)) as ResumeVersion[];
  }
  function createProfile(value: unknown): LocalProfile {
    const row: LocalProfile = {
      id: randomUUID(),
      name: name(value),
      createdAt: now(),
    };
    db.exec("BEGIN IMMEDIATE");
    try {
      insertProfile.run(row.id, row.name, row.createdAt);
      db.exec("COMMIT");
      return row;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  function renameProfile(profileId: string, value: unknown): LocalProfile {
    const id = requireProfile(profileId);
    db.prepare("UPDATE profiles SET name=? WHERE id=?").run(name(value), id);
    return selectProfile.get(id) as LocalProfile;
  }
  function deleteProfile(profileId: string) {
    const id = requireProfile(profileId);
    if (id === DEFAULT_PROFILE_ID)
      throw new Error("Default profile cannot be deleted.");
    db.prepare("DELETE FROM profiles WHERE id=?").run(id);
  }
  function listContacts(profileId: string): ProfileContact[] {
    return listContactRows
      .all(requireProfile(profileId))
      .map((row) => decodeContact(row)!);
  }
  function createContact(
    profileId: string,
    contact: unknown,
    label: unknown,
  ): ProfileContact {
    const owner = requireProfile(profileId);
    const valid = validateContact(contact);
    if (!isUsableContact(valid))
      throw new Error(
        "Contact requires first name, last name, and a valid email.",
      );
    const id = addContact(
      owner,
      valid,
      name(label),
      !getDefaultContact.get(owner),
    );
    return decodeContact(
      selectContact.get(owner, id),
    ) as unknown as ProfileContact;
  }
  function updateContactRecord(
    profileId: string,
    contactId: string,
    contact: unknown,
    label?: unknown,
  ): ProfileContact {
    const owner = requireProfile(profileId);
    if (!decodeContact(selectContact.get(owner, validId(contactId))))
      throw new Error("Contact not found for profile.");
    const valid = validateContact(contact);
    if (!isUsableContact(valid))
      throw new Error(
        "Contact requires first name, last name, and a valid email.",
      );
    updateContact.run(...contactValues(valid), owner, contactId);
    if (label !== undefined)
      db.prepare(
        "UPDATE profile_contact SET name=? WHERE profile_id=? AND id=?",
      ).run(name(label), owner, contactId);
    return decodeContact(
      selectContact.get(owner, contactId),
    ) as unknown as ProfileContact;
  }
  function deleteContactRecord(profileId: string, contactId: string) {
    const owner = requireProfile(profileId);
    const id = validId(contactId);
    const selected = decodeContact(selectContact.get(owner, id)) as unknown as
      ProfileContact | undefined;
    if (!selected) throw new Error("Contact not found for profile.");
    const linked = db
      .prepare(
        "SELECT COUNT(*) AS count FROM resumes WHERE profile_id=? AND contact_id=?",
      )
      .get(owner, id) as { count: number };
    if (linked.count > 0)
      throw new Error(
        "This contact is linked to " +
          linked.count +
          " resume(s). Select another contact for those resumes before deleting it.",
      );
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("DELETE FROM profile_contact WHERE profile_id=? AND id=?").run(
        owner,
        id,
      );
      if (selected.isDefault) {
        const remaining = db
          .prepare(
            "SELECT id FROM profile_contact WHERE profile_id=? ORDER BY name,id LIMIT 1",
          )
          .get(owner) as { id: string } | undefined;
        if (remaining)
          db.prepare(
            "UPDATE profile_contact SET is_default=1 WHERE id=? AND profile_id=?",
          ).run(remaining.id, owner);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return { deleted: true };
  }
  function setDefaultContact(
    profileId: string,
    contactId: string,
  ): ProfileContact {
    const owner = requireProfile(profileId);
    if (!decodeContact(selectContact.get(owner, validId(contactId))))
      throw new Error("Contact not found for profile.");
    const chosen = decodeContact(
      selectContact.get(owner, contactId),
    ) as unknown as ProfileContact;
    if (!isUsableContact(chosen))
      throw new Error(
        "Default contact must have a first name, last name, and valid email.",
      );
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(
        "UPDATE profile_contact SET is_default=0 WHERE profile_id=?",
      ).run(owner);
      db.prepare(
        "UPDATE profile_contact SET is_default=1 WHERE profile_id=? AND id=?",
      ).run(owner, contactId);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return decodeContact(
      selectContact.get(owner, contactId),
    ) as unknown as ProfileContact;
  }
  function resolveImportContact(
    profileId: string,
    resumeId: string,
    incoming: unknown,
    choices: unknown,
  ) {
    const owner = requireProfile(profileId);
    const resume = requireResume(owner, resumeId);
    const parsed = validateContact(incoming);
    if (!choices || typeof choices !== "object" || Array.isArray(choices))
      throw new Error("Contact choices are required.");
    const decisions = choices as Record<string, unknown>;
    if (
      Object.entries(decisions).some(
        ([key, value]) =>
          !CONTACT_KEYS.includes(key as (typeof CONTACT_KEYS)[number]) ||
          !["resume", "shared", "keep"].includes(String(value)),
      )
    )
      throw new Error("Invalid contact import choice.");
    const current = resume.contactId
      ? (decodeContact(
          selectContact.get(owner, resume.contactId),
        ) as unknown as ProfileContact)
      : null;
    const shared = current
      ? (Object.fromEntries(
          CONTACT_KEYS.map((key) => [key, current[key] || ""]),
        ) as CandidateProfile["contact"])
      : emptyContact();
    const tailored = { ...shared };
    let hasResumeDifference = false;
    for (const key of CONTACT_KEYS) {
      const value = (parsed[key] || "").trim();
      if (!value || value === shared[key]) continue;
      const choice = decisions[key] ?? "resume";
      if (choice === "shared") shared[key] = value;
      if (choice === "resume") {
        tailored[key] = value;
        hasResumeDifference = true;
      }
    }
    // Shared updates also flow into newly created contact records unless a
    // resume-specific choice explicitly overrides that field.
    for (const key of CONTACT_KEYS)
      if ((decisions[key] ?? "resume") !== "resume")
        tailored[key] = shared[key] || "";
    db.exec("BEGIN IMMEDIATE");
    try {
      if (current && CONTACT_KEYS.some((key) => shared[key] !== current[key]))
        updateContact.run(...contactValues(shared), owner, current.id);
      let contactId = current?.id ?? null;
      if (hasResumeDifference || !current) {
        if (isUsableContact(tailored)) {
          const duplicate = listContacts(owner).find((item) =>
            CONTACT_KEYS.every((key) => item[key] === tailored[key]),
          );
          contactId =
            duplicate?.id ??
            addContact(
              owner,
              tailored,
              "Imported contact",
              !getDefaultContact.get(owner),
            );
        }
      }
      db.prepare(
        "UPDATE resumes SET contact_id=?,updated_at=? WHERE profile_id=? AND id=?",
      ).run(contactId, now(), owner, resume.id);
      db.exec("COMMIT");
      return { contactId, contact: tailored, contacts: listContacts(owner) };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  function createResume(
    profileId: string,
    value: unknown,
    copyId?: string,
  ): ResumeVersion {
    const owner = requireProfile(profileId);
    const source = copyId ? requireResume(owner, copyId) : null;
    const defaultId = (
      getDefaultContact.get(owner) as { id: string } | undefined
    )?.id;
    const row: ResumeVersion = {
      id: randomUUID(),
      name: name(value),
      contactId: source ? source.contactId : (defaultId ?? null),
      createdAt: now(),
      updatedAt: now(),
    };
    insertResume.run(
      row.id,
      owner,
      row.contactId,
      row.name,
      source?.json ?? null,
      row.createdAt,
      row.updatedAt,
    );
    return row;
  }
  function renameResume(
    profileId: string,
    resumeId: string,
    value: unknown,
  ): ResumeVersion {
    const row = requireResume(profileId, resumeId);
    const next = name(value),
      updatedAt = now();
    db.prepare(
      "UPDATE resumes SET name=?,updated_at=? WHERE profile_id=? AND id=?",
    ).run(next, updatedAt, profileId, row.id);
    return {
      id: row.id,
      contactId: row.contactId,
      name: next,
      createdAt: row.createdAt,
      updatedAt,
    };
  }
  function deleteResume(profileId: string, resumeId: string) {
    const owner = requireProfile(profileId);
    requireResume(owner, resumeId);
    db.prepare("DELETE FROM resumes WHERE id=? AND profile_id=?").run(
      resumeId,
      owner,
    );
  }
  const {
    getEmployerAccount,
    listEmployerAccounts,
    insertEmployerAccount,
    updateEmployerAccount,
  } = createEmployerAccountsStatements(db);
  function getOrCreateEmployerAccount(
    profileId: string,
    identity: {
      provider: string;
      employerKey: string;
      employerName: string;
      host: string;
    },
  ): EmployerAccount {
    const owner = requireProfile(profileId);
    if (
      !/^[a-z-]+$/.test(identity.provider) ||
      !identity.employerKey ||
      identity.employerKey.length > 250 ||
      !identity.employerName?.trim() ||
      identity.employerName.length > 200 ||
      !identity.host
    )
      throw new Error("Invalid employer account details.");
    insertEmployerAccount.run(
      owner,
      identity.provider,
      identity.employerKey,
      identity.employerName,
      identity.host,
      now(),
    );
    return getEmployerAccount.get(
      owner,
      identity.provider,
      identity.employerKey,
    ) as EmployerAccount;
  }
  function listAccounts(profileId: string): EmployerAccount[] {
    return listEmployerAccounts.all(
      requireProfile(profileId),
    ) as EmployerAccount[];
  }
  function setEmployerAccountStatus(
    profileId: string,
    provider: string,
    employerKey: string,
    status: "setup_required" | "ready",
  ): EmployerAccount {
    const owner = requireProfile(profileId);
    if (!["setup_required", "ready"].includes(status))
      throw new Error("Invalid employer account status.");
    if (!getEmployerAccount.get(owner, provider, employerKey))
      throw new Error("Employer account not found.");
    updateEmployerAccount.run(status, now(), owner, provider, employerKey);
    return getEmployerAccount.get(
      owner,
      provider,
      employerKey,
    ) as EmployerAccount;
  }
  /** Resume content has its own revision, independent of applications. */
  function getResumeContent(profileId = DEFAULT_PROFILE_ID, resumeId?: string) {
    const owner = requireProfile(profileId);
    const id = resumeId ?? listResumes(owner)[0]?.id;
    if (!id) throw new Error("No resume exists for profile.");
    const row = requireResume(owner, id);
    const selectedContact = row.contactId
      ? decodeContact(selectContact.get(owner, row.contactId))
      : null;
    const contact = selectedContact
      ? (Object.fromEntries(
          CONTACT_KEYS.map((key) => [key, selectedContact[key] || ""]),
        ) as CandidateProfile["contact"])
      : null;
    if (row.contactId && !contact)
      throw new Error("Selected resume contact not found.");
    const document = row.json ? validateResume(JSON.parse(row.json)) : null;
    return {
      resumeId: row.id,
      revision: row.revision,
      contactId: row.contactId,
      profile: document
        ? { ...document, contact: contact ?? document.contact }
        : null,
    };
  }

  function saveResumeContent(
    raw: unknown,
    profileId = DEFAULT_PROFILE_ID,
    resumeId?: string,
  ) {
    const owner = requireProfile(profileId);
    const id = resumeId ?? listResumes(owner)[0]?.id;
    if (!id) throw new Error("No resume selected.");
    requireResume(owner, id);
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error("Invalid resume update.");
    const payload = raw as Record<string, unknown>;
    const candidate =
      payload.profile == null ? null : validateResume(payload.profile);
    const contactId =
      payload.contactId == null || payload.contactId === ""
        ? null
        : validId(String(payload.contactId));
    if (contactId && !decodeContact(selectContact.get(owner, contactId)))
      throw new Error("Contact does not belong to selected profile.");
    const revision = payload.revision;
    if (
      typeof revision !== "number" ||
      !Number.isSafeInteger(revision) ||
      revision < 0
    )
      throw new Error("Expected a nonnegative resume revision.");
    db.exec("BEGIN IMMEDIATE");
    try {
      const current = requireResume(owner, id).revision;
      if (current !== revision) {
        const error = new Error(
          "Resume changed in another tab. Reload to avoid overwriting it.",
        ) as Error & { code?: string };
        error.code = "STALE_STATE";
        throw error;
      }
      const content = candidate
        ? JSON.stringify(
            contactId ? { ...candidate, contact: emptyContact() } : candidate,
          )
        : null;
      db.prepare(
        "UPDATE resumes SET contact_id=?,content_json=?,content_revision=?,updated_at=? WHERE profile_id=? AND id=?",
      ).run(contactId, content, current + 1, now(), owner, id);
      db.exec("COMMIT");
      return { revision: current + 1 };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function getJobList(profileId = DEFAULT_PROFILE_ID) {
    const owner = requireProfile(profileId);
    const revisions: Record<string, number> = {};
    const jobs = (
      getJobs.all(owner) as unknown as (JobRecord & {
        resumeId: string | null;
        accountAction: "signup" | "login" | null;
        detailsJson: string | null;
        revision: number;
      })[]
    ).map(
      ({
        resumeId,
        accountAction,
        detailsJson,
        revision,
        ...job
      }): JobRecord => {
        revisions[job.id] = revision;
        return {
          ...job,
          ...(resumeId ? { resumeId } : {}),
          ...(accountAction ? { accountAction } : {}),
          ...(detailsJson ? { details: JSON.parse(detailsJson) } : {}),
        };
      },
    );
    return { jobs, revisions };
  }

  function staleJob(): Error & { code: string } {
    return Object.assign(
      new Error(
        "This application changed in another tab. Reload before saving it.",
      ),
      {
        code: "STALE_STATE",
      },
    );
  }

  function updateJobRecord(raw: unknown, profileId = DEFAULT_PROFILE_ID) {
    const owner = requireProfile(profileId);
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error("Invalid application update.");
    const payload = raw as Record<string, unknown>;
    const [job] = validateJobs([payload.job]);
    const revision = payload.revision;
    if (
      typeof revision !== "number" ||
      !Number.isSafeInteger(revision) ||
      revision < 0
    )
      throw new Error("Expected a nonnegative application revision.");
    const association = job as JobRecord & { resumeId?: string | null };
    const selectedResume = association.resumeId ?? null;
    if (selectedResume) requireResume(owner, selectedResume);
    db.exec("BEGIN IMMEDIATE");
    try {
      const existing = getJobRevision.get(owner, job.id) as
        { revision: number } | undefined;
      if (
        (existing?.revision ?? 0) !== revision ||
        (!existing && revision !== 0)
      )
        throw staleJob();
      if (existing) {
        const updated = db
          .prepare(
            `UPDATE applications SET resume_id=?,account_action=?,details_json=?,company=?,role=?,url=?,
          status=?,created_at=?,notes=?,revision=revision+1
          WHERE profile_id=? AND id=? AND revision=?`,
          )
          .run(
            selectedResume,
            job.accountAction ?? null,
            job.details ? JSON.stringify(job.details) : null,
            job.company,
            job.role,
            job.url,
            job.status,
            job.createdAt,
            job.notes,
            owner,
            job.id,
            revision,
          );
        if (!updated.changes) throw staleJob();
      } else {
        db.prepare(
          `INSERT INTO applications(profile_id,id,resume_id,account_action,details_json,company,role,url,status,created_at,notes,revision)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`,
        ).run(
          owner,
          job.id,
          selectedResume,
          job.accountAction ?? null,
          job.details ? JSON.stringify(job.details) : null,
          job.company,
          job.role,
          job.url,
          job.status,
          job.createdAt,
          job.notes,
        );
      }
      db.exec("COMMIT");
      return { revision: revision + 1 };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function deleteJobRecord(
    jobId: string,
    raw: unknown,
    profileId = DEFAULT_PROFILE_ID,
  ) {
    const owner = requireProfile(profileId);
    const id = validId(jobId);
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error("Invalid application deletion.");
    const revision = (raw as Record<string, unknown>).revision;
    if (
      typeof revision !== "number" ||
      !Number.isSafeInteger(revision) ||
      revision < 0
    )
      throw new Error("Expected a nonnegative application revision.");
    db.exec("BEGIN IMMEDIATE");
    try {
      const deleted = db
        .prepare(
          "DELETE FROM applications WHERE profile_id=? AND id=? AND revision=?",
        )
        .run(owner, id, revision);
      if (!deleted.changes) {
        if (!getJobRevision.get(owner, id))
          throw new Error("Application not found.");
        throw staleJob();
      }
      db.exec("COMMIT");
      return { deleted: true };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  /** Update only this application's status and revision. */
  function setJobStatus(profileId: string, jobId: string, status: string) {
    const owner = requireProfile(profileId);
    const id = validId(jobId);
    if (!statuses.has(status)) throw new Error("Invalid job status.");
    const updated = db
      .prepare(
        "UPDATE applications SET status=?,revision=revision+1 WHERE profile_id=? AND id=?",
      )
      .run(status, owner, id);
    if (!updated.changes) throw new Error("Application not found.");
    return { updated: true };
  }
  /** Read reusable examples without ever changing another application's answers. */
  function listAnswerLibrary(profileId: string, currentJobId: string) {
    const owner = requireProfile(profileId);
    const id = validId(currentJobId);
    if (!getJobRevision.get(owner, id)) throw new Error("Application not found.");
    const rows = db.prepare(`
      SELECT a.application_id AS applicationId, a.question, a.answer,
             a.updated_at AS updatedAt, j.company, j.role
      FROM application_answers a
      JOIN applications j ON j.id=a.application_id AND j.profile_id=a.profile_id
      WHERE a.profile_id=? AND a.application_id<>?
      ORDER BY a.updated_at DESC, a.application_id, a.question
      LIMIT 150
    `).all(owner, id) as {
      applicationId: string; question: string; answer: string;
      updatedAt: string; company: string; role: string;
    }[];
    return rows.filter(({ question, answer }) => reusableAnswer(question, answer));

  }

  /** Current answers and library examples are projections of the same SQLite table. */
  function getApplicationAnswerContext(profileId: string, jobId: string) {
    return {
      answers: listApplicationAnswers(profileId, jobId),
      examples: listAnswerLibrary(profileId, jobId),
    };
  }

  /** Optimistic, application-owned CRUD on the same table used by captured answers. */
  function createApplicationAnswer(profileId: string, applicationId: string, question: string, answer: string) {
    const owner = requireProfile(profileId), id = validId(applicationId);
    if (!getJobRevision.get(owner, id)) throw new Error("Source application not found.");
    if (!reusableAnswer(question, answer)) throw new Error("Invalid or restricted screening answer.");
    const normalizedLabel = question.trim(), normalizedValue = answer.trim();
    const timestamp = now();
    const result = db.prepare(
      "INSERT OR IGNORE INTO application_answers(profile_id,application_id,question,answer,updated_at) VALUES (?,?,?,?,?)"
    ).run(owner, id, normalizedLabel, normalizedValue, timestamp);
    if (!result.changes) throw new Error("An answer already exists for that application and question.");
    return { applicationId: id, question: normalizedLabel, answer: normalizedValue, updatedAt: timestamp };
  }

  function updateApplicationAnswer(
    profileId: string, applicationId: string, question: string,
    expectedAnswer: string, expectedUpdatedAt: string, answer: string,
  ) {
    const owner = requireProfile(profileId), id = validId(applicationId);
    if (!getJobRevision.get(owner, id)) throw new Error("Source application not found.");
    if (!reusableAnswer(question, answer) || typeof expectedAnswer !== "string" ||
        typeof expectedUpdatedAt !== "string") throw new Error("Invalid answer update.");
    const timestamp = now();
    const result = db.prepare(`
      UPDATE application_answers SET answer=?,updated_at=?
      WHERE profile_id=? AND application_id=? AND question=? AND answer=? AND updated_at=?
    `).run(answer.trim(), timestamp, owner, id, question, expectedAnswer, expectedUpdatedAt);
    if (!result.changes) throw new Error("Answer changed or was deleted. Reload before editing.");
    return { applicationId: id, question, answer: answer.trim(), updatedAt: timestamp };
  }

  function deleteApplicationAnswer(
    profileId: string, applicationId: string, question: string,
    expectedAnswer: string, expectedUpdatedAt: string,
  ) {
    const owner = requireProfile(profileId), id = validId(applicationId);
    if (!getJobRevision.get(owner, id)) throw new Error("Source application not found.");
    if (!reusableAnswer(question, expectedAnswer) || typeof expectedUpdatedAt !== "string")
      throw new Error("Invalid answer deletion.");
    const result = db.prepare(`
      DELETE FROM application_answers
      WHERE profile_id=? AND application_id=? AND question=? AND answer=? AND updated_at=?
    `).run(owner, id, question, expectedAnswer, expectedUpdatedAt);
    if (!result.changes) throw new Error("Answer changed or was deleted. Reload before deleting.");
    return { deleted: true };
  }

  /** Preserve written screening answers only for the matching application. */
  function listApplicationAnswers(profileId: string, jobId: string) {
    const owner = requireProfile(profileId);
    const id = validId(jobId);
    if (!getJobRevision.get(owner, id)) throw new Error("Application not found.");
    const rows = db.prepare(
      "SELECT question,answer FROM application_answers WHERE profile_id=? AND application_id=? ORDER BY question"
    ).all(owner, id) as { question: string; answer: string }[];
    return Object.fromEntries(rows.map(({ question, answer }) => [question, answer]));
  }
  function saveApplicationAnswers(profileId: string, jobId: string, answers: Record<string, string>) {
    const owner = requireProfile(profileId);
    const id = validId(jobId);
    if (!getJobRevision.get(owner, id)) throw new Error("Application not found.");
    if (!answers || typeof answers !== "object" || Array.isArray(answers) || Object.keys(answers).length > 100)
      throw new Error("Invalid application answers.");
    const statement = db.prepare(
      `INSERT INTO application_answers(profile_id,application_id,question,answer,updated_at)
       VALUES (?,?,?,?,?) ON CONFLICT(profile_id,application_id,question)
       DO UPDATE SET answer=excluded.answer,updated_at=excluded.updated_at`
    );
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const [question, answer] of Object.entries(answers)) {
        if (!question.trim() || question.length > 300 ||
            typeof answer !== "string" || !answer.trim() || answer.length > 4000)
          throw new Error("Invalid question or answer.");
        // Only ordinary application-specific screening responses, not identity,
        // account credentials, medical/disability or voluntary demographic data.
        if (!reusableAnswer(question, answer)) continue;
        statement.run(owner, id, question, answer, now());
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return listApplicationAnswers(owner, id);
  }
  return {
    listProfiles,
    createProfile,
    renameProfile,
    deleteProfile,
    listContacts,
    createContact,
    updateContactRecord,
    deleteContactRecord,
    setDefaultContact,
    resolveImportContact,
    listResumes,
    createResume,
    renameResume,
    deleteResume,
    getOrCreateEmployerAccount,
    listAccounts,
    setEmployerAccountStatus,
    getResumeContent,
    saveResumeContent,
    getJobList,
    updateJobRecord,
    deleteJobRecord,
    setJobStatus,
    saveApplicationAnswers,
    listApplicationAnswers,
    listAnswerLibrary,
    getApplicationAnswerContext,
    createApplicationAnswer,
    updateApplicationAnswer,
    deleteApplicationAnswer,
    close: () => db.close(),
  };
}
