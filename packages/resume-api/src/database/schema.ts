import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";

/** Initialize the current application schema. No schema versions or migrations. */
export function initializeDatabase(db: DatabaseSync): void {
  db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
}
