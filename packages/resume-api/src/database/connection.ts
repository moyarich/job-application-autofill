import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
export function openConnection(filePath: string): DatabaseSync {
  const path = filePath === ":memory:" ? filePath : resolve(filePath);
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") {
    try { chmodSync(path, 0o600); } catch { /* Filesystems differ. */ }
  }
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  return db;
}
