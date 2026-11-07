import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";

const CURRENT_SCHEMA_VERSION = 1;
const initialTables = [
  "profiles.sql",
  "profile-contact.sql",
  "resumes.sql",
  "employer-accounts.sql",
  "applications.sql",
] as const;

/** Version 1 is the current schema, not an upgrade from an older app. */
export function initializeDatabase(db: DatabaseSync): void {
  const version = (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
  if (version === CURRENT_SCHEMA_VERSION) return;
  if (version !== 0)
    throw new Error("Unsupported database schema version: " + version);
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 1").get())
    throw new Error("Expected a fresh database for schema version 1.");

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const table of initialTables) {
      db.exec(readFileSync(new URL("./tables/" + table, import.meta.url), "utf8"));
    }
    db.exec("PRAGMA user_version = " + CURRENT_SCHEMA_VERSION);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
