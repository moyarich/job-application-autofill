import type { ApplicationReviewActionsContext } from "./review-context";
import { requestApi } from "../api/client";
import type { ApplySession } from "./types";

/** prepareAccountSignUp action; no React hooks or state ownership. */
export function createPrepareAccountSignUp(context: ApplicationReviewActionsContext) {
  const { activeProfileId, activeResumeId, session, setMessage, setApplyBusy, setSession, setReviewed } = context;
  async function prepareAccountSignUp(password?: string) {
    if (!session) return;
    setApplyBusy(true);
    try {
      const updated = await requestApi<ApplySession>(
        "/api/apply/" + session.id + "/account-signup",
        { ...(password ? { password } : {}) },
        activeProfileId,
        activeResumeId ?? undefined,
      );
      setSession(updated);
      setReviewed(false);
      setMessage(updated.message);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to prepare employer account.",
      );
    } finally {
      setApplyBusy(false);
    }
  }
  return prepareAccountSignUp;
}
