import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/store.ts";

const sample = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json", import.meta.url), "utf8"));
test("per-resume contact overrides survive reload, duplication, and shared contact edits", () => {
  const db = openStore(":memory:");
  try {
    const first = db.listResumes(DEFAULT_PROFILE_ID)[0];
    const second = db.createResume(DEFAULT_PROFILE_ID,"Cloud");
    const original = structuredClone(sample);
    const cloud = structuredClone(sample);
    cloud.contact.email = "cloud@example.com";
    cloud.experience[0].jobTitle = "Cloud Engineer";
    db.saveSnapshot({ revision: 0, profile: original, jobs: [] }, DEFAULT_PROFILE_ID, first.id);
    db.saveSnapshot({ revision: 1, profile: cloud, contact: original.contact,
      contactOverrides: { email: "cloud@example.com" }, jobs: [] }, DEFAULT_PROFILE_ID, second.id);
    expect(db.getSnapshot(DEFAULT_PROFILE_ID, second.id).profile!.contact.email).toBe("cloud@example.com");
    expect(db.getSnapshot(DEFAULT_PROFILE_ID, first.id).profile!.contact.email).toBe("ada@example.com");
    const copy = db.createResume(DEFAULT_PROFILE_ID,"Cloud copy",second.id);
    expect(db.getSnapshot(DEFAULT_PROFILE_ID, copy.id).contactOverrides).toEqual({ email: "cloud@example.com" });
    const updated = structuredClone(original);
    updated.contact.phone = "555-0123";
    db.saveSnapshot({ revision: 2, profile: updated, contact: updated.contact,
      contactOverrides: {}, jobs: [] }, DEFAULT_PROFILE_ID, first.id);
    expect(db.getSnapshot(DEFAULT_PROFILE_ID, second.id).profile!.contact.phone).toBe("555-0123");
    expect(db.getSnapshot(DEFAULT_PROFILE_ID, second.id).profile!.contact.email).toBe("cloud@example.com");
    expect(db.getSnapshot(DEFAULT_PROFILE_ID, second.id).profile!.experience[0].jobTitle).toBe("Cloud Engineer");
    expect(() => db.saveSnapshot({ revision: 3, profile: cloud, contact: original.contact,
      contactOverrides: { unsupported: "x" }, jobs: [] }, DEFAULT_PROFILE_ID, second.id)).toThrow(/overrides/i);
  } finally { db.close(); }
});
