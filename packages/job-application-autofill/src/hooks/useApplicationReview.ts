import { useState, useEffect } from "react";
import type { ApplySession } from "../utils/application/types";
import type { ApplicationReviewData } from "../utils/application/review-data";
import { createPrepareJob } from "../utils/application/prepareJob";
import { createPrepareAccountSignUp } from "../utils/application/prepareAccountSignUp";
import { createSetEmployerAccountStatus } from "../utils/application/setEmployerAccountStatus";
import { createContinueAfterChallenge } from "../utils/application/continueAfterChallenge";
import { createFinalizeApplication } from "../utils/application/finalizeApplication";
export function useApplicationReview(workspace: ApplicationReviewData) {
  const {
    applicationId,
    activeProfileId,
    activeResumeId,
    profile,
    contactId,
    errors,
    setTab,
    setMessage,
  } = workspace;
  const { changeJob } = workspace;
  const [activeLoaded, setActiveLoaded] = useState(!applicationId);
  const [applyBusy, setApplyBusy] = useState(false);

  const [session, setSession] = useState<ApplySession | null>(null);
  const [reviewed, setReviewed] = useState(false);
  useEffect(() => {
    if (!applicationId || session?.state !== "preparing") return;
    let cancelled = false;
    const timer = setInterval(() => {
      fetch("/api/apply/" + session.id, {
        headers: {
          "X-Moya-Client": "dashboard",
          "X-Profile-Id": activeProfileId,
        },
      })
        .then((response) => {
          if (!response.ok)
            throw new Error(
              "Application session is unavailable. Reload to retry.",
            );
          return response.json();
        })
        .then((updated) => {
          if (!cancelled) setSession(updated);
        })
        .catch((error) => {
          if (!cancelled) setMessage(String(error));
        });
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [applicationId, session?.id, session?.state, activeProfileId]);
  useEffect(() => {
    let cancelled = false;
    if (!applicationId) return;
    fetch("/api/apply/active?jobId=" + encodeURIComponent(applicationId), {
      headers: {
        "X-Moya-Client": "dashboard",
        "X-Profile-Id": activeProfileId,
      },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!cancelled && result?.session)
          setSession(result.session as ApplySession);
      })
      .catch(() => {
        /* Local API might not be running. */
      })
      .finally(() => {
        if (!cancelled) setActiveLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const reviewContext = {
    applicationId,
    activeProfileId,
    activeResumeId,
    profile,
    contactId,
    errors,
    session,
    reviewed,
    setTab,
    changeJob,
    setMessage,
    setApplyBusy,
    setSession,
    setReviewed,
  };
  const prepareJob = createPrepareJob(reviewContext);
  const prepareAccountSignUp = createPrepareAccountSignUp(reviewContext);
  const setEmployerAccountStatus =
    createSetEmployerAccountStatus(reviewContext);
  const continueAfterChallenge = createContinueAfterChallenge(reviewContext);
  const finalizeApplication = createFinalizeApplication(reviewContext);

  return {
    applicationId,
    activeLoaded,
    setActiveLoaded,
    session,
    setSession,
    applyBusy,
    setApplyBusy,
    reviewed,
    setReviewed,
    prepareJob,
    prepareAccountSignUp,
    setEmployerAccountStatus,
    continueAfterChallenge,
    finalizeApplication,
  };
}
