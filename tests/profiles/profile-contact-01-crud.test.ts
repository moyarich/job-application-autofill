import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  openStore,
  DEFAULT_PROFILE_ID,
} from "../../packages/resume-api/src/database/store.ts";

const sample = JSON.parse(
  readFileSync(
    new URL(
      "../../packages/resume/src/resume-schema/resume.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

test("profile contact CRUD preserves resume links and promotes next default", () => {
  const db = openStore(":memory:");
  try {
    const first = db.createContact(
      DEFAULT_PROFILE_ID,
      sample.contact,
      "Personal",
    );
    const second = db.createContact(
      DEFAULT_PROFILE_ID,
      { ...sample.contact, email: "other@example.com" },
      "Other",
    );
    expect(db.listContacts(DEFAULT_PROFILE_ID)).toHaveLength(2);
    expect(first.isDefault).toBeTruthy();
    const updated = db.updateContactRecord(
      DEFAULT_PROFILE_ID,
      second.id,
      { ...sample.contact, email: "different@example.com" },
      "Work",
    );
    expect(updated.name).toBe("Work");
    expect(updated.email).toBe("different@example.com");
    const otherProfile = db.createProfile("Someone else");
    expect(() => db.deleteContactRecord(otherProfile.id, second.id)).toThrow(
      /not found/i,
    );
    expect(() =>
      db.updateContactRecord(otherProfile.id, first.id, sample.contact),
    ).toThrow(/not found/i);
    const resume = db.createResume(DEFAULT_PROFILE_ID, "Linked");
    expect(resume.contactId).toBe(first.id);
    expect(() => db.deleteContactRecord(DEFAULT_PROFILE_ID, first.id)).toThrow(
      /linked/i,
    );
    expect(db.listContacts(DEFAULT_PROFILE_ID)).toHaveLength(2);
    // Deleting an unused contact must leave the default unchanged.
    expect(db.deleteContactRecord(DEFAULT_PROFILE_ID, second.id)).toEqual({
      deleted: true,
    });
    expect(db.listContacts(DEFAULT_PROFILE_ID).map((c) => c.id)).toEqual([
      first.id,
    ]);
    const alternative = db.createContact(
      DEFAULT_PROFILE_ID,
      { ...sample.contact, email: "new@example.com" },
      "New",
    );
    db.setDefaultContact(DEFAULT_PROFILE_ID, alternative.id);
    // Deleting the now-unused default picks an existing contact as the new default.
    expect(db.deleteContactRecord(DEFAULT_PROFILE_ID, alternative.id)).toEqual({
      deleted: true,
    });
    expect(db.listContacts(DEFAULT_PROFILE_ID)).toHaveLength(1);
    expect(db.listContacts(DEFAULT_PROFILE_ID)[0].isDefault).toBeTruthy();
    expect(db.getResumeContent(DEFAULT_PROFILE_ID, resume.id).contactId).toBe(
      first.id,
    );
  } finally {
    db.close();
  }
});

test("structured contact details are shared with linked resumes and survive updates", () => {
  const db = openStore(":memory:");
  try {
    const contact = {
      ...sample.contact,
      addressLine1: "123 Example St",
      addressLine2: "Unit 4",
      city: "Chicago",
      state: "Illinois",
      postalCode: "60618",
      country: "United States of America",
      phoneCountryCode: "United States of America (+1)",
      phoneType: "Mobile",
    };
    const saved = db.createContact(DEFAULT_PROFILE_ID, contact, "Personal");
    expect(db.listContacts(DEFAULT_PROFILE_ID)[0]).toMatchObject(contact);
    const resume = db.createResume(DEFAULT_PROFILE_ID, "Linked");
    const snapshot = db.getResumeContent(DEFAULT_PROFILE_ID, resume.id);
    db.saveResumeContent(
      { revision: snapshot.revision, profile: { ...sample, contact }, contactId: snapshot.contactId },
      DEFAULT_PROFILE_ID,
      resume.id,
    );
    db.updateContactRecord(DEFAULT_PROFILE_ID, saved.id, {
      ...contact,
      city: "Evanston",
    });
    expect(
      db.getResumeContent(DEFAULT_PROFILE_ID, resume.id).profile?.contact,
    ).toMatchObject({ ...contact, city: "Evanston" });
  } finally {
    db.close();
  }
});

test("address fields can be cleared and contacts with addresses can be deleted", () => {
  const db = openStore(":memory:");
  try {
    const contact = db.createContact(
      DEFAULT_PROFILE_ID,
      { ...sample.contact, addressLine1: "123 Example St", city: "Chicago" },
      "Temporary",
    );
    expect(contact.addressLine1).toBe("123 Example St");
    db.updateContactRecord(DEFAULT_PROFILE_ID, contact.id, {
      ...sample.contact,
      addressLine1: "",
      city: "",
    });
    expect(db.listContacts(DEFAULT_PROFILE_ID)[0].addressLine1 || "").toBe("");
    expect(db.deleteContactRecord(DEFAULT_PROFILE_ID, contact.id)).toEqual({
      deleted: true,
    });
    expect(db.listContacts(DEFAULT_PROFILE_ID)).toEqual([]);
  } finally {
    db.close();
  }
});

test("contacts with only some address fields still produce valid resume snapshots", () => {
  const db = openStore(":memory:");
  try {
    db.createContact(
      DEFAULT_PROFILE_ID,
      { ...sample.contact, city: "Chicago" },
      "Personal",
    );
    const resume = db.createResume(DEFAULT_PROFILE_ID, "Linked");
    const snapshot = db.getResumeContent(DEFAULT_PROFILE_ID, resume.id);
    db.saveResumeContent(
      { revision: snapshot.revision, profile: { ...sample, contact: { ...sample.contact, city: "Chicago" } }, contactId: snapshot.contactId },
      DEFAULT_PROFILE_ID,
      resume.id,
    );
    expect(() =>
      db.saveResumeContent(
        db.getResumeContent(DEFAULT_PROFILE_ID, resume.id),
        DEFAULT_PROFILE_ID,
        resume.id,
      ),
    ).not.toThrow();
  } finally {
    db.close();
  }
});
