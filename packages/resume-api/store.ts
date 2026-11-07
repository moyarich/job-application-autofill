// Public entry point retained for existing consumers; implementation lives in src/database.
export { openStore, DEFAULT_PROFILE_ID } from "./src/database/store.ts";
export type { LocalProfile, ResumeVersion, ProfileContact, EmployerAccount } from "./src/database/store.ts";
