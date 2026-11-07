import { test, expect } from "vitest";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/src/database/store.ts";

test("local people may be renamed or deleted but default person is protected", () => {
  const db = openStore(":memory:");
  try {
    const person = db.createProfile("John");
    expect(db.renameProfile(person.id, "John Smith").name).toBe("John Smith");
    expect(db.listProfiles().find(row => row.id === person.id)?.name).toBe("John Smith");
    expect(() => db.deleteProfile(DEFAULT_PROFILE_ID)).toThrow(/default profile/i);
    db.deleteProfile(person.id);
    expect(() => db.getJobList(person.id)).toThrow(/not found/i);
  } finally { db.close(); }
});
