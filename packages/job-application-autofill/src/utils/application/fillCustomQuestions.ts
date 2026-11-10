import type { ApplicationReviewActionsContext } from "./review-context";
import { requestApi } from "../api/client";
import type { ApplySession } from "./types";

/** fillCustomQuestions action; no React hooks or state ownership. */
export function createFillCustomQuestions(
  context: ApplicationReviewActionsContext,
) {
  const {
    activeProfileId,
    activeResumeId,
    session,
    questionAnswers,
    setMessage,
    setApplyBusy,
    setSession,
    setReviewed,
  } = context;
  async function fillCustomQuestions() {
    if (!session) return;
    setApplyBusy(true);
    try {
      const updated = await requestApi<ApplySession>(
        "/api/apply/" + session.id + "/answers",
        { answers: questionAnswers },
        activeProfileId,
        activeResumeId ?? undefined,
      );
      setSession(updated);
      setReviewed(false);
      setMessage(
        updated.answerResult?.unresolved.length
          ? "Could not resolve: " +
              updated.answerResult.unresolved.join(", ") +
              ". Please use the browser viewer."
          : updated.message,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to fill employer questions.",
      );
    } finally {
      setApplyBusy(false);
    }
  }
  return fillCustomQuestions;
}
