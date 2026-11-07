import { test, expect } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/src/database/store.ts";

test("fresh database creates a profile and unlinked draft resume without placeholder contacts", () => {
  const dir = mkdtempSync(join(tmpdir(),"moya-fresh-db-"));
  const file = join(dir,"fresh.sqlite");
  try {
    let db = openStore(file);
    let snapshot = db.getResumeContent(DEFAULT_PROFILE_ID);
    expect(db.listProfiles()).toHaveLength(1);
    expect(snapshot.revision).toBe(0);
    expect(snapshot.profile).toBeNull();
    expect(db.getJobList(DEFAULT_PROFILE_ID).jobs).toEqual([]);
    expect(db.listResumes(DEFAULT_PROFILE_ID)).toHaveLength(1);
    expect(db.listContacts(DEFAULT_PROFILE_ID)).toHaveLength(0);
    expect(snapshot.contactId).toBeNull();
    expect(db.listContacts(DEFAULT_PROFILE_ID).filter(c => c.isDefault)).toHaveLength(0);
    expect(db.listResumes(DEFAULT_PROFILE_ID)[0].contactId).toBeNull();
    
    const draft = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json",import.meta.url),"utf8"));
    draft.contact.email = "";
    db.saveResumeContent({revision:0,profile:draft,contactId:null},DEFAULT_PROFILE_ID,snapshot.resumeId);
    expect(db.listContacts(DEFAULT_PROFILE_ID)).toHaveLength(0);
    db.close();

    db = openStore(file);
    snapshot = db.getResumeContent(DEFAULT_PROFILE_ID);
    expect(db.listResumes(DEFAULT_PROFILE_ID)).toHaveLength(1);
    expect(db.listContacts(DEFAULT_PROFILE_ID)).toHaveLength(0);
    expect(snapshot.contactId).toBeNull();
    expect(snapshot.profile!.contact.email).toBe("");
    expect(snapshot.profile!.contact.firstName).toBe(draft.contact.firstName);
    expect(db.createResume(DEFAULT_PROFILE_ID,"Second").contactId).toBeNull();
    db.close();
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
