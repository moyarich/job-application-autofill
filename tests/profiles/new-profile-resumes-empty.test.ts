import { test, expect } from "vitest";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/src/database/store.ts";

test("profiles start without placeholder resumes and permit deleting the last resume", () => {
  const db = openStore(":memory:");
  try {
    expect(db.listResumes(DEFAULT_PROFILE_ID)).toEqual([]);
    const person = db.createProfile("New person");
    expect(db.listResumes(person.id)).toEqual([]);
    const resume = db.createResume(person.id, "Actual resume");
    expect(db.listResumes(person.id)).toHaveLength(1);
    db.deleteResume(person.id, resume.id);
    expect(db.listResumes(person.id)).toEqual([]);
    expect(db.listResumes(DEFAULT_PROFILE_ID)).toEqual([]);
  } finally { db.close(); }
});
