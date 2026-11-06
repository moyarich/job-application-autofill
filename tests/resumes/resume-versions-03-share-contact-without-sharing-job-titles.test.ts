import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/store.ts";

const candidate = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json", import.meta.url), "utf8"));

test("contact changes follow the person, not a resume, while tailored roles remain independent", () => {
  const db = openStore(":memory:");
  try {
    const first = db.listResumes(DEFAULT_PROFILE_ID)[0];
    const second = db.createResume(DEFAULT_PROFILE_ID, "Cloud engineer");
    const firstVersion = structuredClone(candidate);
    firstVersion.experience[0].jobTitle = "Software Engineer";
    const secondVersion = structuredClone(candidate);
    secondVersion.experience[0].jobTitle = "Cloud Engineer";
    secondVersion.experience[0].description = "Managed AWS infrastructure.";
    secondVersion.contact.email = "new@example.com";
    db.saveSnapshot({ revision: 0, profile: firstVersion, jobs: [] }, DEFAULT_PROFILE_ID, first.id);
    db.saveSnapshot({ revision: 1, profile: secondVersion, jobs: [] }, DEFAULT_PROFILE_ID, second.id);
    expect(db.getSnapshot(DEFAULT_PROFILE_ID, first.id).profile!.contact.email).toBe("new@example.com");
    expect(db.getSnapshot(DEFAULT_PROFILE_ID, first.id).profile!.experience[0].jobTitle).toBe("Software Engineer");
    expect(db.getSnapshot(DEFAULT_PROFILE_ID, second.id).profile!.experience[0].jobTitle).toBe("Cloud Engineer");
    expect(db.getSnapshot(DEFAULT_PROFILE_ID, second.id).profile!.experience[0].description).toBe("Managed AWS infrastructure.");
    const third = db.createResume(DEFAULT_PROFILE_ID, "New resume");
    expect(db.getSnapshot(DEFAULT_PROFILE_ID, third.id).contact!.email).toBe("new@example.com");
    expect(db.getSnapshot(DEFAULT_PROFILE_ID, third.id).profile).toBeNull();
    const other = db.createProfile("Different person");
    expect(db.getSnapshot(other.id).contact?.email).toBe("");
  } finally { db.close(); }
});
