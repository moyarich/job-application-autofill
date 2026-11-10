import { test, expect } from "vitest";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/src/database/store.ts";
import { readFileSync } from "node:fs";

test("saved middle and preferred names persist and remain attached to the selected contact", () => {
  const sample = JSON.parse(readFileSync(
    new URL("../../packages/resume/src/resume-schema/resume.example.json", import.meta.url), "utf8",
  ));
  const store = openStore(":memory:");
  try {
    const saved = store.createContact(DEFAULT_PROFILE_ID, {
      ...sample.contact,
      middleName: "Jay",
      preferredName: "MJ",
    }, "Primary");
    expect(saved).toMatchObject({ middleName: "Jay", preferredName: "MJ" });
    const record = store.listContacts(DEFAULT_PROFILE_ID)[0];
    expect(record).toMatchObject({ middleName: "Jay", preferredName: "MJ" });
    const resume = store.createResume(DEFAULT_PROFILE_ID, "Linked");
    expect(store.getResumeContent(DEFAULT_PROFILE_ID, resume.id).profile?.contact)
      .toMatchObject({ middleName: "Jay", preferredName: "MJ" });
  } finally {
    store.close();
  }
});
