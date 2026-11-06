import { test, expect } from "vitest";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/store.ts";

test("two local people have independent résumés and application histories", () => {
  const db = openStore(":memory:");
  try {
    const jane = db.createProfile("Jane");
    const john = db.createProfile("John");
    const janeResume = db.listResumes(jane.id)[0];
    const johnResume = db.listResumes(john.id)[0];
    const job = { id: "e8796d4c-828e-4634-aa60-ab39bc95e241", company: "Example", role: "Engineer", url: "https://example.com/job",
      status: "saved", createdAt: "2026-11-05T12:00:00.000Z", notes: "Jane's note" };
    expect(db.saveSnapshot({ revision: 0, profile: null, jobs: [job] }, jane.id, janeResume.id)).toEqual({ revision: 1 });
    expect(db.getSnapshot(jane.id, janeResume.id).jobs).toEqual([job]);
    expect(db.getSnapshot(john.id, johnResume.id).jobs).toEqual([]);
    expect(db.getSnapshot(DEFAULT_PROFILE_ID).jobs).toEqual([]);
    expect(db.getSnapshot(john.id).revision).toBe(0);
  } finally { db.close(); }
});
