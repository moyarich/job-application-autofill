import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/store.ts";

const sample = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json",import.meta.url),"utf8"));

test("saved contact records are reusable; drafts have no contact ID", () => {
  const db = openStore(":memory:");
  try {
    const first = db.listResumes(DEFAULT_PROFILE_ID)[0];
    expect(first.contactId).toBeNull();
    expect(db.listContacts(DEFAULT_PROFILE_ID)).toEqual([]);
    expect(() => db.createContact(DEFAULT_PROFILE_ID,{...sample.contact,firstName:""},"Incomplete")).toThrow(/requires/i);
    db.saveResumeContent({revision:0,profile:sample,contactId:null},DEFAULT_PROFILE_ID,first.id);
    const contact = db.createContact(DEFAULT_PROFILE_ID,sample.contact,"Primary");
    expect(contact.isDefault).toBeTruthy();
    const firstSnapshot = db.getResumeContent(DEFAULT_PROFILE_ID,first.id);
    db.saveResumeContent({revision:1,profile:firstSnapshot.profile,contactId:contact.id},DEFAULT_PROFILE_ID,first.id);
    const second = db.createResume(DEFAULT_PROFILE_ID,"Cloud");
    expect(second.contactId).toBe(contact.id);
    const copied = db.createResume(DEFAULT_PROFILE_ID,"Copy",first.id);
    expect(copied.contactId).toBe(contact.id);
    const updated = {...sample.contact,phone:"555-0123"};
    db.updateContactRecord(DEFAULT_PROFILE_ID,contact.id,updated);
    expect(db.getResumeContent(DEFAULT_PROFILE_ID,first.id).profile!.contact.phone).toBe("555-0123");
    expect(db.getResumeContent(DEFAULT_PROFILE_ID,copied.id).profile!.contact.phone).toBe("555-0123");
    const other = db.createProfile("Other");
    expect(() => db.setDefaultContact(other.id,contact.id)).toThrow(/not found/);
  } finally { db.close(); }
});

test("resume import with no existing contact creates a selected reusable contact", () => {
  const db = openStore(":memory:");
  try {
    const primary = db.listResumes(DEFAULT_PROFILE_ID)[0];
    const result = db.resolveImportContact(DEFAULT_PROFILE_ID,primary.id,sample.contact,{});
    expect(result.contactId).not.toBeNull();
    expect(db.getResumeContent(DEFAULT_PROFILE_ID,primary.id).contactId).toBe(result.contactId);
    expect(db.listContacts(DEFAULT_PROFILE_ID).filter(item => item.isDefault)).toHaveLength(1);
    const secondary = db.createResume(DEFAULT_PROFILE_ID,"Second");
    expect(secondary.contactId).toBe(result.contactId);
    const other = db.createProfile("Other");
    expect(db.listContacts(other.id)).toEqual([]);
  } finally { db.close(); }
});
