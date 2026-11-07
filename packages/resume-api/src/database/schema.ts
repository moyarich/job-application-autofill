import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";

const tables = [
  "profiles.sql",
  "profile-contact.sql",
  "resumes.sql",
  "employer-accounts.sql",
  "applications.sql",
] as const;

/** Create current tables in foreign-key dependency order; no migration layer. */
export function initializeDatabase(db: DatabaseSync): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const table of tables) {
      db.exec(readFileSync(new URL("./tables/" + table, import.meta.url), "utf8"));
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
