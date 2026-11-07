import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";

const SCHEMA_VERSION = 1;

/** A single canonical schema. Old incompatible databases are not migrated. */
export function initializeDatabase(db: DatabaseSync): void {
  const version = (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
  if (version === SCHEMA_VERSION) return;
  if (version !== 0) throw new Error("Unsupported SQLite schema version: " + version);

  const objects = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND type IN ('table','view','trigger') LIMIT 1",
  ).get();
  if (objects) throw new Error("Existing SQLite schema is incompatible. Use a fresh database.");

  const sql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(sql);
    db.exec("PRAGMA user_version = " + SCHEMA_VERSION);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
