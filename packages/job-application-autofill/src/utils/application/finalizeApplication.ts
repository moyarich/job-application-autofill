import type { ApplySession } from "../../types/types";
import type { ApplicationReviewActionsContext } from "../../types/application-review-actions-context";
import { finalizeApplicationSession } from "../../api/applications";

/** finalizeApplication action; no React hooks or state ownership. */
export function createFinalizeApplication(
  context: ApplicationReviewActionsContext,
) {
  const {
    activeProfileId,
    activeResumeId,
    session,
    reviewed,
    changeJob,
    setMessage,
    setApplyBusy,
    setSession,
  } = context;
  async function finalizeApplication(submit: boolean) {
    if (!session) return;
    if (submit && session.reviewUrl && !reviewed) {
      setMessage(
        "Open the browser viewer and confirm you reviewed the application first.",
      );
      return;
    }
    if (
      submit &&
      !window.confirm(
        "Confirm final submission? Check every field in the opened browser first.",
      )
    )
      return;
    setApplyBusy(true);
    try {
      const result = await finalizeApplicationSession(
        session.id,
        submit,
        session.reviewUrl ? reviewed : true,
        activeProfileId,
        activeResumeId ?? undefined,
      );
      if (submit) {
        const next = result as ApplySession;
        setSession(next);
        setMessage(next.message);
        changeJob(
          session.jobId,
          next.state === "submitted" ? "submitted" : "in_progress",
        );
      } else {
        setSession(null);
        setMessage("Browser session closed. Application status is unchanged.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Browser action failed",
      );
    } finally {
      setApplyBusy(false);
    }
  }
  return finalizeApplication;
}
