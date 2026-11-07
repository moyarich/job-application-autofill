import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../../packages/resume-api/src/database/store.ts";
import { initializeDatabase } from "../../packages/resume-api/src/database/schema.ts";

describe("SQLite schema", () => {
  it("initializes independent tables and persists records after reopening", () => {
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
        expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='profile_state'").get()).toBeUndefined();
        for (const [table, field] of [["applications", "revision"], ["resumes", "content_revision"], ["profile_contact", "extra_json"]]) {
          expect((db.prepare("PRAGMA table_info(" + table + ")").all() as { name: string }[])
            .some(column => column.name === field)).toBe(true);
        }
      } finally { db.close(); }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("initializes the same current schema repeatedly without losing records", () => {
    const db = new DatabaseSync(":memory:");
    try {
      initializeDatabase(db);
      db.prepare("INSERT INTO profiles(id,name,created_at) VALUES (?,?,?)")
        .run("test-profile", "Test", "2026-11-07T00:00:00.000Z");
      initializeDatabase(db);
      expect(db.prepare("SELECT name FROM profiles WHERE id=?").get("test-profile"))
        .toMatchObject({ name: "Test" });
    } finally { db.close(); }
  });
});
