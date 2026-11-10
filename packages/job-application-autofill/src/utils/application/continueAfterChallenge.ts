import { readActiveApplication } from "../../api/applications";
import type { ApplicationReviewActionsContext } from "../../types/application-review-actions-context";
import { continueApplicationSession } from "../../api/applications";

/** continueAfterChallenge action; no React hooks or state ownership. */
export function createContinueAfterChallenge(
  context: ApplicationReviewActionsContext,
  recoverSession?: () => Promise<void>,
) {
  const {
    activeProfileId,
    activeResumeId,
    session,
    changeJob,
    setMessage,
    setApplyBusy,
    setSession,
    setReviewed,
  } = context;
  async function continueAfterChallenge() {
    if (!session) return;
    setApplyBusy(true);
    try {
      const updated = await continueApplicationSession(
        session.id,
        activeProfileId,
        activeResumeId ?? undefined,
      );
      setSession((current) => ({
        ...updated,
        employerAccount: updated.employerAccount ?? current?.employerAccount,
        signupPrepared: updated.signupPrepared ?? current?.signupPrepared,
      }));
      setReviewed(false);
      changeJob(
        updated.jobId,
        updated.state === "ready_for_review"
          ? "ready_for_review"
          : "in_progress",
      );
      setMessage(updated.message);
    } catch (error) {
      if (recoverSession) {
        try {
          const result = await readActiveApplication(
            session.jobId,
            activeProfileId,
          );
          if (!result.session) {
            setSession(null);
            setReviewed(false);
            await recoverSession();
            return;
          }
        } catch {
          /* Retain the original error if the API is unreachable. */
        }
      }
      setMessage(
        error instanceof Error ? error.message : "Challenge is not complete.",
      );
    } finally {
      setApplyBusy(false);
    }
  }
  return continueAfterChallenge;
}
