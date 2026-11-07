import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../../packages/resume-api/src/database/store.ts";
import { migrateDatabase } from "../../packages/resume-api/src/database/migrations.ts";

describe("SQLite versioned migrations", () => {
  it("applies numbered migrations once and keeps saved profiles after reopening", () => {
    const dir = mkdtempSync(join(tmpdir(), "resume-api-migrations-"));
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
        const versions = db.prepare("SELECT id FROM schema_migrations ORDER BY id").all();
        expect(versions.map(v => v.id)).toEqual(["001_initial", "002_contact_extras", "003_resume_revision", "004_application_revisions"]);
        expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='profile_state'").get()).toBeUndefined();
        expect((db.prepare("PRAGMA table_info(applications)").all() as { name: string }[]).some(column => column.name === "revision")).toBe(true);
      } finally { db.close(); }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("adopts a preexisting profile_contact column without altering it twice", () => {
    const db = new DatabaseSync(":memory:");
    try {
      const initial = readFileSync(
        new URL("../../packages/resume-api/src/database/migrations/001_initial.sql", import.meta.url),
        "utf8",
      );
      db.exec(initial);
      db.exec("ALTER TABLE profile_contact ADD COLUMN extra_json TEXT NOT NULL DEFAULT '{}'");
      migrateDatabase(db);
      migrateDatabase(db);
      const columns = db.prepare("PRAGMA table_info(profile_contact)").all() as {name:string}[];
      expect(columns.filter(c => c.name === "extra_json")).toHaveLength(1);
      expect(db.prepare("SELECT COUNT(*) AS total FROM schema_migrations").get()).toMatchObject({ total: 4 });
    } finally { db.close(); }
  });
});
