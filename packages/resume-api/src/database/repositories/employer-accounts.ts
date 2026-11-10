import type { DatabaseSync } from "node:sqlite";

/** Prepared, parameterized SQL for the employer-accounts repository. */
export function createEmployerAccountsStatements(db: DatabaseSync) {
  const getEmployerAccount = db.prepare(
    "SELECT provider,employer_key AS employerKey,employer_name AS employerName,host,status,updated_at AS updatedAt FROM employer_accounts WHERE profile_id=? AND provider=? AND employer_key=?",
  );
  const listEmployerAccounts = db.prepare(
    "SELECT provider,employer_key AS employerKey,employer_name AS employerName,host,status,updated_at AS updatedAt FROM employer_accounts WHERE profile_id=? ORDER BY employer_name,provider,employer_key",
  );
  const insertEmployerAccount = db.prepare(
    "INSERT INTO employer_accounts (profile_id,provider,employer_key,employer_name,host,status,updated_at) VALUES (?,?,?,?,?,'setup_required',?) ON CONFLICT(profile_id,provider,employer_key) DO UPDATE SET employer_name=excluded.employer_name",
  );
  const updateEmployerAccount = db.prepare(
    "UPDATE employer_accounts SET status=?,updated_at=? WHERE profile_id=? AND provider=? AND employer_key=?",
  );
  return {
    getEmployerAccount,
    listEmployerAccounts,
    insertEmployerAccount,
    updateEmployerAccount,
  };
}
