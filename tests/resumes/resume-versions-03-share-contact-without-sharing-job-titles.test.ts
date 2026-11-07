import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/src/database/store.ts";

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
    db.saveResumeContent({revision:0,profile:primary,contactId:null},DEFAULT_PROFILE_ID,first.id);
    db.saveResumeContent({revision:0,profile:cloud,contactId:null},DEFAULT_PROFILE_ID,second.id);
    expect(db.getResumeContent(DEFAULT_PROFILE_ID,first.id).profile!.experience[0].jobTitle).toBe("Software Engineer");
    expect(db.getResumeContent(DEFAULT_PROFILE_ID,second.id).profile!.experience[0].jobTitle).toBe("Cloud Engineer");
    expect(db.getResumeContent(DEFAULT_PROFILE_ID,first.id).profile!.contact.email).toBe(sample.contact.email);
    expect(db.getResumeContent(DEFAULT_PROFILE_ID,second.id).profile!.contact.email).toBe("cloud@example.com");
    expect(db.getResumeContent(DEFAULT_PROFILE_ID,first.id).contactId).toBeNull();
    expect(db.getResumeContent(DEFAULT_PROFILE_ID,second.id).contactId).toBeNull();
    expect(db.listContacts(DEFAULT_PROFILE_ID)).toEqual([]);
    const other = db.createProfile("Other person");
    expect(db.getResumeContent(other.id).profile).toBeNull();
  } finally { db.close(); }
});
