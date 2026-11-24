import { applicationPreferenceSchemas } from "@moyarich/job-boards";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";

const CURRENT_SCHEMA_VERSION = 16;
const initialTables = [
  "profiles.sql",
  "profile-contact.sql",
  "resumes.sql",
  "employer-accounts.sql",
  "applications.sql",
  "application-answers.sql",
  "application-preferences.sql",
  "connections.sql",
  "connection-mappings.sql",
  "connection-transfers.sql",
  "connection-sync-runs.sql",
  "connection-schedules.sql",
  "connection-mcp.sql",
  "connection-workflows.sql",
  "connection-import-workflows.sql",
  "connection-mcp-links.sql",
] as const;

function tableSql(name: string): string {
  return readFileSync(resolve(import.meta.dirname, "tables", name), "utf8");
}

function initializePreferenceSchemas(db: DatabaseSync) {
  const upsert = db.prepare(`
    INSERT INTO application_preference_schemas(job_board, label, schema_json)
    VALUES (?, ?, ?)
    ON CONFLICT(job_board) DO UPDATE SET label=excluded.label, schema_json=excluded.schema_json
    WHERE label<>excluded.label OR schema_json<>excluded.schema_json
  `);
  for (const [board, { label, schema }] of Object.entries(
    applicationPreferenceSchemas,
  ))
    upsert.run(board, label, JSON.stringify(schema));
}

function migratePreferenceBoards(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS application_preference_schemas (
      job_board TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      schema_json TEXT NOT NULL CHECK(json_valid(schema_json))
    );
  `);
  if (
    !db
      .prepare(
        "SELECT 1 FROM pragma_table_info('application_preferences') WHERE name='job_board'",
      )
      .get()
  )
    db.exec(
      "ALTER TABLE application_preferences ADD COLUMN job_board TEXT REFERENCES application_preference_schemas(job_board)",
    );
  db.exec(`
    DROP INDEX IF EXISTS one_default_application_preference;
    CREATE UNIQUE INDEX IF NOT EXISTS one_default_general_preference
      ON application_preferences(profile_id) WHERE is_default=1 AND job_board IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS one_default_board_preference
      ON application_preferences(profile_id,job_board) WHERE is_default=1 AND job_board IS NOT NULL;
  `);
  initializePreferenceSchemas(db);
}

/** Initialize current tables or upgrade an existing database without discarding data. */
export function initializeDatabase(db: DatabaseSync): void {
  const version = (
    db.prepare("PRAGMA user_version").get() as { user_version: number }
  ).user_version;
  if (version === CURRENT_SCHEMA_VERSION) {
    initializePreferenceSchemas(db);
    return;
  }
  if (version >= 1 && version < CURRENT_SCHEMA_VERSION) {
    db.exec("BEGIN IMMEDIATE");
    try {
      if (version === 1)
        db.exec(
          "ALTER TABLE applications ADD COLUMN account_action TEXT CHECK(account_action IN ('signup','login'))",
        );
      if (version < 3)
        db.exec("ALTER TABLE applications ADD COLUMN details_json TEXT");
      db.exec(tableSql("application-answers.sql"));
      if (version < 5) db.exec(tableSql("application-preferences.sql"));
      migratePreferenceBoards(db);
      db.exec(tableSql("connections.sql"));
      db.exec(tableSql("connection-mappings.sql"));
      db.exec(tableSql("connection-transfers.sql"));
      db.exec(tableSql("connection-sync-runs.sql"));
      db.exec(tableSql("connection-schedules.sql"));
      if (version === 12) {
        db.exec("ALTER TABLE connection_mcp RENAME TO connection_mcp_previous");
        db.exec(tableSql("connection-mcp.sql"));
        db.exec("INSERT INTO connection_mcp SELECT * FROM connection_mcp_previous; DROP TABLE connection_mcp_previous");
      } else db.exec(tableSql("connection-mcp.sql"));
      db.exec(tableSql("connection-workflows.sql"));
      db.exec(tableSql("connection-import-workflows.sql"));
      db.exec(tableSql("connection-mcp-links.sql"));
      db.exec("PRAGMA user_version = " + CURRENT_SCHEMA_VERSION);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return;
  }
  if (version !== 0)
    throw new Error("Unsupported database schema version: " + version);
  if (
    db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 1",
      )
      .get()
  )
    throw new Error("Expected a fresh database for schema version 1.");

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const table of initialTables) {
      db.exec(tableSql(table));
    }
    migratePreferenceBoards(db);
    db.exec("PRAGMA user_version = " + CURRENT_SCHEMA_VERSION);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
