import { test, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/store.ts";

test("fresh database creates a profile and unlinked draft resume without placeholder contacts", () => {
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
    expect(snapshot.contacts).toHaveLength(0);
    expect(snapshot.contactId).toBeNull();
    expect(snapshot.defaultContactId).toBeNull();
    expect(snapshot.resumes[0].contactId).toBeNull();
    expect(snapshot.contact).toBeNull();
    db.close();

    db = openStore(file);
    snapshot = db.getSnapshot(DEFAULT_PROFILE_ID);
    expect(snapshot.resumes).toHaveLength(1);
    expect(snapshot.contacts).toHaveLength(0);
    expect(snapshot.contactId).toBeNull();
    expect(db.createResume(DEFAULT_PROFILE_ID,"Second").contactId).toBeNull();
    db.close();
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
