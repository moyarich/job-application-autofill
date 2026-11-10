import type { ApplicationReviewActionsContext } from "../../types/application-review-actions-context";
import { requestApi } from "../../api/client";
import type { ApplySession } from "../../types/types";

/** setEmployerAccountStatus action; no React hooks or state ownership. */
export function createSetEmployerAccountStatus(
  context: ApplicationReviewActionsContext,
) {
  const {
    activeProfileId,
    activeResumeId,
    session,
    setMessage,
    setApplyBusy,
    setSession,
  } = context;
  async function setEmployerAccountStatus(status: "ready" | "setup_required") {
    if (!session?.employerAccount) return;
    setApplyBusy(true);
    try {
      const account = await requestApi<
        NonNullable<ApplySession["employerAccount"]>
      >(
        "/api/employer-accounts/status",
        { jobId: session.jobId, status },
        activeProfileId,
        activeResumeId ?? undefined,
      );
      setSession((current) =>
        current ? { ...current, employerAccount: account } : current,
      );
      setMessage(
        status === "ready"
          ? "Account marked ready for this employer and local profile."
          : "Account signup required for this employer.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update employer account status.",
      );
    } finally {
      setApplyBusy(false);
    }
  }
  return setEmployerAccountStatus;
}
