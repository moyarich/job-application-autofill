import { test, expect } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  openStore,
  DEFAULT_PROFILE_ID,
} from "../../packages/resume-api/src/database/store.ts";

test("a fresh database has no resumes or contacts until they are explicitly created", () => {
  const dir = mkdtempSync(join(tmpdir(), "moya-fresh-db-"));
  const file = join(dir, "fresh.sqlite");
  try {
    let db = openStore(file);
    expect(db.listProfiles()).toHaveLength(1);
    expect(db.listResumes(DEFAULT_PROFILE_ID)).toEqual([]);
    expect(db.listContacts(DEFAULT_PROFILE_ID)).toEqual([]);
    expect(db.getJobList(DEFAULT_PROFILE_ID).jobs).toEqual([]);
    expect(() => db.getResumeContent(DEFAULT_PROFILE_ID)).toThrow(
      /No resume exists/,
    );
    db.close();

    db = openStore(file);
    expect(db.listResumes(DEFAULT_PROFILE_ID)).toEqual([]);
    const created = db.createResume(DEFAULT_PROFILE_ID, "My resume");
    expect(db.getResumeContent(DEFAULT_PROFILE_ID, created.id)).toMatchObject({
      revision: 0,
      profile: null,
      contactId: null,
    });
    const draft = JSON.parse(
      readFileSync(
        new URL(
          "../../packages/resume/src/resume-schema/resume.example.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    draft.contact.email = "";
    db.saveResumeContent(
      { revision: 0, profile: draft, contactId: null },
      DEFAULT_PROFILE_ID,
      created.id,
    );
    expect(db.listContacts(DEFAULT_PROFILE_ID)).toEqual([]);
    db.close();

    db = openStore(file);
    expect(db.listResumes(DEFAULT_PROFILE_ID)).toHaveLength(1);
    expect(
      db.getResumeContent(DEFAULT_PROFILE_ID, created.id).profile!.contact
        .email,
    ).toBe("");
    db.deleteResume(DEFAULT_PROFILE_ID, created.id);
    expect(db.listResumes(DEFAULT_PROFILE_ID)).toEqual([]);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
