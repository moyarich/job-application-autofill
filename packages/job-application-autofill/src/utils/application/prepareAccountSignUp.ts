import type { ApplicationReviewActionsContext } from "../../types/application-review-actions-context";
import { prepareEmployerAccount } from "../../api/applications";

/** prepareAccountSignUp action; no React hooks or state ownership. */
export function createPrepareAccountSignUp(
  context: ApplicationReviewActionsContext,
) {
  const {
    activeProfileId,
    activeResumeId,
    session,
    setMessage,
    setApplyBusy,
    setSession,
    setReviewed,
  } = context;
  async function prepareAccountSignUp(password?: string) {
    if (!session) return;
    setApplyBusy(true);
    try {
      const updated = await prepareEmployerAccount(session.id, password, activeProfileId, activeResumeId ?? undefined);
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
