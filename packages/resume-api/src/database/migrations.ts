import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";

const migrations = [
  { id: "001_initial", file: "001_initial.sql" },
  { id: "002_contact_extras", file: "002_contact_extras.sql" },
] as const;

/**
 * Versioned migrations are the only schema authority. Existing SQLite files
 * are adopted without deleting data or reapplying the contact-column change.
 */
export function migrateDatabase(db: DatabaseSync): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (const migration of migrations) {
    if (db.prepare("SELECT 1 FROM schema_migrations WHERE id=?").get(migration.id))
      continue;
    const sql = readFileSync(new URL("./migrations/" + migration.file, import.meta.url), "utf8");
    db.exec("BEGIN IMMEDIATE");
    try {
      if (migration.id !== "002_contact_extras" ||
          !(db.prepare("PRAGMA table_info(profile_contact)").all() as {name: string}[])
            .some((column) => column.name === "extra_json")) {
        db.exec(sql);
      }
      db.prepare("INSERT INTO schema_migrations (id,applied_at) VALUES (?,?)")
        .run(migration.id, new Date().toISOString());
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
