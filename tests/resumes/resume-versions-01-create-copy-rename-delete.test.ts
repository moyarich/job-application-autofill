import { test, expect } from "vitest";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/store.ts";
import { readFileSync } from "node:fs";

const candidate = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json", import.meta.url), "utf8"));

test("resume versions can be copied, named and deleted without changing the source", () => {
  const db = openStore(":memory:");
  try {
    const primary = db.listResumes(DEFAULT_PROFILE_ID)[0];
    db.saveResumeContent({ revision: 0, profile: candidate, contactId: null }, DEFAULT_PROFILE_ID, primary.id);
    const copy = db.createResume(DEFAULT_PROFILE_ID, "Platform Engineer", primary.id);
    expect(db.getResumeContent(DEFAULT_PROFILE_ID, copy.id).profile).toEqual(candidate);
    expect(db.renameResume(DEFAULT_PROFILE_ID, copy.id, "DevOps Engineer").name).toBe("DevOps Engineer");
    const original = db.getResumeContent(DEFAULT_PROFILE_ID, primary.id);
    expect(original.profile).toEqual(candidate);
    db.deleteResume(DEFAULT_PROFILE_ID, copy.id);
    expect(() => db.getResumeContent(DEFAULT_PROFILE_ID, copy.id)).toThrow(/not found/i);
    expect(() => db.deleteResume(DEFAULT_PROFILE_ID, primary.id)).toThrow(/at least one/i);
  } finally { db.close(); }
});

test("copying an unlinked draft keeps it unlinked even when a default contact exists", () => {
  const db = openStore(":memory:");
  try {
    const draft = db.listResumes(DEFAULT_PROFILE_ID)[0];
    db.saveResumeContent({revision:0,profile:candidate,contactId:null},DEFAULT_PROFILE_ID,draft.id);
    const saved = db.createContact(DEFAULT_PROFILE_ID,candidate.contact,"Default");
    expect(saved.isDefault).toBeTruthy();
    const duplicate = db.createResume(DEFAULT_PROFILE_ID,"Copied draft",draft.id);
    expect(duplicate.contactId).toBeNull();
    expect(db.getResumeContent(DEFAULT_PROFILE_ID,duplicate.id).profile).toEqual(candidate);
    expect(db.createResume(DEFAULT_PROFILE_ID,"New resume").contactId).toBe(saved.id);
  } finally { db.close(); }
});
