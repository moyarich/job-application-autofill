import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/src/database/store.ts";

const candidate = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json", import.meta.url), "utf8"));

test("saving a named resume only updates that version and keeps job history shared per person", () => {
  const db = openStore(":memory:");
  try {
    const first = db.listResumes(DEFAULT_PROFILE_ID)[0];
    const second = db.createResume(DEFAULT_PROFILE_ID, "Engineering Manager");
    const changed = structuredClone(candidate);
    changed.summary = "Manager version";
    db.saveResumeContent({ revision: 0, profile: candidate, contactId: null }, DEFAULT_PROFILE_ID, first.id);
    db.saveResumeContent({ revision: 0, profile: changed, contactId: null }, DEFAULT_PROFILE_ID, second.id);
    expect(db.getResumeContent(DEFAULT_PROFILE_ID, first.id).profile).toEqual(candidate);
    expect(db.getResumeContent(DEFAULT_PROFILE_ID, second.id).profile).toEqual(changed);
    expect(db.getResumeContent(DEFAULT_PROFILE_ID).revision).toBe(1);
    expect(db.getResumeContent(DEFAULT_PROFILE_ID, second.id).revision).toBe(1);
    expect(db.getJobList(DEFAULT_PROFILE_ID).revisions).toEqual({});
    expect(() => db.saveResumeContent({ revision: 0, profile: changed, contactId: null }, DEFAULT_PROFILE_ID, first.id)).toThrow(/another tab/i);
  } finally { db.close(); }
});
