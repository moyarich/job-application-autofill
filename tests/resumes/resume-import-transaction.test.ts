import { test, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/src/database/store.ts";
import { emptyCandidate } from "../../packages/job-application-autofill/src/index.ts";

const profile = { ...structuredClone(emptyCandidate), contact: {
  ...emptyCandidate.contact, firstName: "Ada", lastName: "Lovelace", email: "ada@example.com",
} };

test("imports resume content and its contact in one commit", () => {
  const store = openStore(":memory:");
  try {
    const result = store.importResumeDocument(DEFAULT_PROFILE_ID, { name: "Imported", profile, choices: {} });
    expect(result.revision).toBe(1);
    expect(store.listResumes(DEFAULT_PROFILE_ID)).toHaveLength(1);
    expect(store.listContacts(DEFAULT_PROFILE_ID)).toHaveLength(1);
    expect(store.getResumeContent(DEFAULT_PROFILE_ID, result.resumeId).profile?.contact.email).toBe("ada@example.com");
    const before = store.listContacts(DEFAULT_PROFILE_ID);
    expect(() => store.importResumeDocument(DEFAULT_PROFILE_ID, {
      resumeId: result.resumeId, revision: 0,
      profile: { ...profile, contact: { ...profile.contact, firstName: "Changed" } },
      choices: { firstName: "shared" },
    })).toThrow(/changed in another tab/i);
    expect(store.listContacts(DEFAULT_PROFILE_ID)).toEqual(before);
    expect(store.getResumeContent(DEFAULT_PROFILE_ID, result.resumeId).revision).toBe(1);
  } finally { store.close(); }
});

test("a failed content write leaves no resume or imported contact behind", () => {
  const directory = mkdtempSync(join(tmpdir(), "moya-import-"));
  const path = join(directory, "test.sqlite");
  const store = openStore(path);
  const db = new DatabaseSync(path);
  try {
    db.exec(`CREATE TRIGGER reject_content BEFORE UPDATE OF content_json ON resumes
      BEGIN SELECT RAISE(ABORT, 'fixture write failure'); END;`);
    expect(() => store.importResumeDocument(DEFAULT_PROFILE_ID, { name: "Failed import", profile, choices: {} })).toThrow(/fixture write failure/);
    expect(db.prepare("SELECT COUNT(*) AS count FROM resumes").get()?.count).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS count FROM profile_contact").get()?.count).toBe(0);
  } finally { db.close(); store.close(); rmSync(directory, { recursive: true, force: true }); }
});
