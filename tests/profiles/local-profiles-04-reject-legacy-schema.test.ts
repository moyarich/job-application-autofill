import { test, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../../packages/resume-api/store.ts";

test("new-only schema rejects an old SQLite database without importing its data", () => {
  const folder = mkdtempSync(join(tmpdir(), "profile-schema-"));
  const path = join(folder, "old.sqlite");
  try {
    const old = new DatabaseSync(path);
    old.exec("CREATE TABLE resume_profile (id INTEGER PRIMARY KEY, json TEXT)");
    old.prepare("INSERT INTO resume_profile (id,json) VALUES (1,?)").run('{"contact":{"firstName":"Legacy"}}');
    old.close();
    expect(() => openStore(path)).toThrow(/Legacy SQLite schema is unsupported/i);
    const reopened = new DatabaseSync(path);
    expect(reopened.prepare("SELECT json FROM resume_profile WHERE id=1").get()).toBeDefined();
    reopened.close();
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
