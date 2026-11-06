import type { JobSiteAdapter, BrowserSignInSession } from "../types.ts";

/**
 * Existing-account sign-in is optional. Each provider must scope credentials
 * to its intended employer host before entering them.
 */
export async function prepareSignIn(adapter: JobSiteAdapter, session: BrowserSignInSession): Promise<void> {
  if (adapter.helpSignIn) await adapter.helpSignIn(session);
}
