import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../../packages/resume-api/src/database/store.ts";
import { initializeDatabase } from "../../packages/resume-api/src/database/schema.ts";

describe("SQLite schema", () => {
  it("initializes current independent tables and persists records after reopening", () => {
    const dir = mkdtempSync(join(tmpdir(), "resume-api-schema-"));
    const path = join(dir, "app.sqlite");
    try {
      const first = openStore(path);
      const created = first.createProfile("Persistent");
      first.close();
      const second = openStore(path);
      try {
        expect(second.listProfiles().some(p => p.id === created.id)).toBe(true);
      } finally { second.close(); }

      const db = new DatabaseSync(path);
      try {
        expect(db.prepare("PRAGMA user_version").get()).toMatchObject({ user_version: 3 });
        expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='profile_state'").get()).toBeUndefined();
        for (const [table, field] of [["applications", "revision"], ["resumes", "content_revision"], ["profile_contact", "extra_json"]]) {
          expect((db.prepare("PRAGMA table_info(" + table + ")").all() as { name: string }[])
            .some(column => column.name === field)).toBe(true);
        }
      } finally { db.close(); }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("preserves existing data when initializing the current version again", () => {
    const db = new DatabaseSync(":memory:");
    try {
      initializeDatabase(db);
      db.prepare("INSERT INTO profiles(id,name,created_at) VALUES (?,?,?)")
        .run("test-profile", "Test", "2026-11-07T00:00:00.000Z");
      initializeDatabase(db);
      expect(db.prepare("SELECT name FROM profiles WHERE id=?").get("test-profile"))
        .toMatchObject({ name: "Test" });
      expect(db.prepare("PRAGMA user_version").get()).toMatchObject({ user_version: 3 });
    } finally { db.close(); }
  });
});

it("upgrades account and job details without dropping existing application records", () => {
  const db = new DatabaseSync(":memory:");
  try {
    initializeDatabase(db);
    db.exec("ALTER TABLE applications DROP COLUMN details_json; PRAGMA user_version = 2");
    db.prepare("INSERT INTO profiles(id,name,created_at) VALUES (?,?,?)").run("owner", "Owner", "2026-11-09");
    db.prepare("INSERT INTO applications(profile_id,id,company,role,url,status,created_at,account_action) VALUES (?,?,?,?,?,?,?,?)")
      .run("owner", "job", "Example", "Developer", "https://example.com/jobs/1", "saved", "2026-11-09", "login");
    initializeDatabase(db);
    expect(db.prepare("SELECT role,account_action,details_json FROM applications WHERE id='job'").get()).toMatchObject({ role: "Developer", account_action: "login", details_json: null });
    expect(db.prepare("PRAGMA user_version").get()).toMatchObject({ user_version: 3 });
  } finally { db.close(); }
});
