import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/store.ts";

const sample = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json",import.meta.url),"utf8"));

test("draft resumes preserve independent content without inventing contacts", () => {
  const db = openStore(":memory:");
  try {
    const first = db.listResumes(DEFAULT_PROFILE_ID)[0];
    const second = db.createResume(DEFAULT_PROFILE_ID,"Cloud engineer");
    const primary = structuredClone(sample);
    const cloud = structuredClone(sample);
    primary.experience[0].jobTitle = "Software Engineer";
    cloud.experience[0].jobTitle = "Cloud Engineer";
    cloud.contact.email = "cloud@example.com";
    db.saveSnapshot({revision:0,profile:primary,jobs:[]},DEFAULT_PROFILE_ID,first.id);
    db.saveSnapshot({revision:1,profile:cloud,jobs:[]},DEFAULT_PROFILE_ID,second.id);
    expect(db.getSnapshot(DEFAULT_PROFILE_ID,first.id).profile!.experience[0].jobTitle).toBe("Software Engineer");
    expect(db.getSnapshot(DEFAULT_PROFILE_ID,second.id).profile!.experience[0].jobTitle).toBe("Cloud Engineer");
    expect(db.getSnapshot(DEFAULT_PROFILE_ID,first.id).profile!.contact.email).toBe(sample.contact.email);
    expect(db.getSnapshot(DEFAULT_PROFILE_ID,second.id).profile!.contact.email).toBe("cloud@example.com");
    expect(db.getSnapshot(DEFAULT_PROFILE_ID,first.id).contactId).toBeNull();
    expect(db.getSnapshot(DEFAULT_PROFILE_ID,second.id).contactId).toBeNull();
    expect(db.listContacts(DEFAULT_PROFILE_ID)).toEqual([]);
    const other = db.createProfile("Other person");
    expect(db.getSnapshot(other.id).contact).toBeNull();
  } finally { db.close(); }
});
