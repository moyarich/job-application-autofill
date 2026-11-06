import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/store.ts";

const sample = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json", import.meta.url), "utf8"));

test("each resume references a reusable contact record belonging to the same profile", () => {
  const db = openStore(":memory:");
  try {
    const first = db.listResumes(DEFAULT_PROFILE_ID)[0];
    const defaultId = first.contactId;
    expect(db.listContacts(DEFAULT_PROFILE_ID).filter(contact => contact.isDefault)).toHaveLength(1);
    const original = structuredClone(sample);
    db.saveSnapshot({revision:0,profile:original,jobs:[]},DEFAULT_PROFILE_ID,first.id);
    const different = {...original.contact,email:"cloud@example.com"};
    const contact = db.createContact(DEFAULT_PROFILE_ID,different,"Cloud contact");
    const cloud = db.createResume(DEFAULT_PROFILE_ID,"Cloud");
    const cloudProfile = {...structuredClone(original),contact:different};
    cloudProfile.experience[0].jobTitle = "Cloud Engineer";
    db.saveSnapshot({revision:1,profile:cloudProfile,contact:different,contactId:contact.id,jobs:[]},DEFAULT_PROFILE_ID,cloud.id);
    expect(db.getSnapshot(DEFAULT_PROFILE_ID,cloud.id).contactId).toBe(contact.id);
    expect(db.getSnapshot(DEFAULT_PROFILE_ID,first.id).contactId).toBe(defaultId);
    expect(db.getSnapshot(DEFAULT_PROFILE_ID,first.id).profile!.contact.email).toBe(original.contact.email);
    const copy = db.createResume(DEFAULT_PROFILE_ID,"Cloud duplicate",cloud.id);
    expect(db.getSnapshot(DEFAULT_PROFILE_ID,copy.id).contactId).toBe(contact.id);
    const updated = {...different,phone:"555-0123"};
    db.updateContactRecord(DEFAULT_PROFILE_ID,contact.id,updated);
    expect(db.getSnapshot(DEFAULT_PROFILE_ID,copy.id).profile!.contact.phone).toBe("555-0123");
    expect(db.getSnapshot(DEFAULT_PROFILE_ID,cloud.id).profile!.experience[0].jobTitle).toBe("Cloud Engineer");
    expect(db.getSnapshot(DEFAULT_PROFILE_ID,first.id).profile!.contact.phone).not.toBe("555-0123");
    expect(db.setDefaultContact(DEFAULT_PROFILE_ID,contact.id).id).toBe(contact.id);
    expect(db.listContacts(DEFAULT_PROFILE_ID).filter(item => item.isDefault)).toHaveLength(1);
    expect(db.createResume(DEFAULT_PROFILE_ID,"New default").contactId).toBe(contact.id);
    const foreign = db.createProfile("Other person");
    expect(() => db.saveSnapshot({revision:2,profile:original,contact:original.contact,contactId:contact.id,jobs:[]},foreign.id,db.listResumes(foreign.id)[0].id))
      .toThrow(/contact/i);
  } finally { db.close(); }
});

test("importing contact differences creates reusable records and updates shared contacts explicitly", () => {
  const db = openStore(":memory:");
  try {
    const resume = db.listResumes(DEFAULT_PROFILE_ID)[0];
    db.saveSnapshot({revision:0,profile:sample,jobs:[]},DEFAULT_PROFILE_ID,resume.id);
    const second = db.createResume(DEFAULT_PROFILE_ID,"Second resume",resume.id);
    const changed = {...sample.contact,email:"other@example.com",phone:"555-9876"};
    const separate = db.resolveImportContact(DEFAULT_PROFILE_ID,resume.id,changed,{email:"resume",phone:"keep"});
    expect(separate.contact.email).toBe("other@example.com");
    expect(separate.contact.phone).toBe(sample.contact.phone);
    expect(separate.contactId).not.toBe(second.contactId);
    expect(db.getSnapshot(DEFAULT_PROFILE_ID,second.id).profile!.contact.email).toBe(sample.contact.email);
    const shared = db.resolveImportContact(DEFAULT_PROFILE_ID,second.id,changed,{email:"shared",phone:"keep"});
    expect(shared.contactId).toBe(second.contactId);
    expect(db.getSnapshot(DEFAULT_PROFILE_ID,second.id).profile!.contact.email).toBe("other@example.com");
    expect(db.getSnapshot(DEFAULT_PROFILE_ID,resume.id).contactId).toBe(separate.contactId);
    expect(db.getSnapshot(DEFAULT_PROFILE_ID,resume.id).profile!.contact.email).toBe("other@example.com");
    const other = db.createProfile("Other");
    expect(() => db.setDefaultContact(other.id,separate.contactId)).toThrow(/Contact not found/);
  } finally { db.close(); }
});
