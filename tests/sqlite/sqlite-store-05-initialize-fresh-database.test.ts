import { test, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/store.ts";

test("fresh empty SQLite file initializes a profile, default contact and primary resume atomically", () => {
  const dir = mkdtempSync(join(tmpdir(),"moya-fresh-db-"));
  const file = join(dir,"fresh.sqlite");
  try {
    let db = openStore(file);
    let snapshot = db.getSnapshot(DEFAULT_PROFILE_ID);
    expect(db.listProfiles()).toHaveLength(1);
    expect(snapshot.revision).toBe(0);
    expect(snapshot.profile).toBeNull();
    expect(snapshot.jobs).toEqual([]);
    expect(snapshot.resumes).toHaveLength(1);
    expect(snapshot.contacts).toHaveLength(1);
    expect(snapshot.contactId).toBe(snapshot.defaultContactId);
    expect(snapshot.resumes[0].contactId).toBe(snapshot.contactId);
    expect(snapshot.contacts[0].isDefault).toBeTruthy();
    expect(snapshot.contact?.email).toBe("");
    db.close();

    db = openStore(file);
    snapshot = db.getSnapshot(DEFAULT_PROFILE_ID);
    expect(snapshot.resumes).toHaveLength(1);
    expect(snapshot.contacts).toHaveLength(1);
    expect(snapshot.contactId).toBe(snapshot.contacts[0].id);
    expect(db.createResume(DEFAULT_PROFILE_ID,"Second").contactId).toBe(snapshot.defaultContactId);
    db.close();
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
