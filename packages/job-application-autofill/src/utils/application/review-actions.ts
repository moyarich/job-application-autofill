import type { Dispatch, SetStateAction } from "react";
import { parseCandidateJson, type CandidateProfile, type JobApplication, type ApplicationStatus } from "../../index";
import { requestApi } from "../api/client";
import { filePayload } from "../files/resume-files";
import type { ApplySession } from "./types";
type Update<T> = Dispatch<SetStateAction<T>>;
export type ApplicationReviewActionsContext = {
  applicationId: string | null;
  activeProfileId: string;
  activeResumeId: string | null;
  profile: CandidateProfile;
  contactId: string | null;
  errors: string[];
  session: ApplySession | null;
  reviewed: boolean;
  questionAnswers: Record<string, string>;
  setTab: (next: "profile") => void;
  changeJob: (id: string, status: ApplicationStatus) => void;
  setMessage: Update<string>;
  setApplyBusy: Update<boolean>;
  setSession: Update<ApplySession | null>;
  setReviewed: Update<boolean>;
  setQuestionAnswers: Update<Record<string, string>>;
};
/** Employer application commands: no React state, effects or hooks. */
export function createApplicationReviewActions({
  applicationId, activeProfileId, activeResumeId, profile, contactId,
  errors, session, reviewed, questionAnswers, setTab, changeJob,
  setMessage, setApplyBusy, setSession, setReviewed, setQuestionAnswers,
}: ApplicationReviewActionsContext) {
  async function prepareJob(job: JobApplication) {
    if (!applicationId) {
      const url = new URL(window.location.href);
      url.pathname = "/apply/" + encodeURIComponent(job.id);
      url.search = "";
      url.searchParams.set("profile", activeProfileId);
      if (activeResumeId) url.searchParams.set("resume", activeResumeId);
      window.open(url.href, "application-" + job.id);
      return;
    }
    if (session) return;
    if (!job.url) {
      setMessage("Add a job URL before applying.");
      return;
    }
    if (!contactId || errors.length) {
      setMessage(
        "Select a saved contact with first name, last name and email before applying.",
      );
      setTab("profile");
      return;
    }
    setApplyBusy(true);
    setMessage(
      "Preparing structured resume JSON and PDF attachment for browser review...",
    );
    try {
      // The JSON drives autofill. The application also needs a PDF attachment.
      // Generate from resolved data, never attach an outdated imported PDF.
      const validProfile = parseCandidateJson(JSON.stringify(profile));
      const generated = await requestApi<{ base64: string }>(
        "/api/resume/pdf",
        validProfile,
        activeProfileId,
        activeResumeId ?? undefined,
      );
      const attachment = new File(
        [Uint8Array.from(atob(generated.base64), (char) => char.charCodeAt(0))],
        (
          [validProfile.contact.firstName, validProfile.contact.lastName]
            .filter(Boolean)
            .join("-") || "resume"
        ).replace(/[^a-z0-9-]/gi, "_") + ".pdf",
        { type: "application/pdf" },
      );
      const upload = await filePayload(attachment);
      const result = await requestApi<ApplySession>(
        "/api/apply/prepare",
        {
          jobUrl: job.url,
          jobId: job.id,
          profile: validProfile,
          resume: upload,
        },
        activeProfileId,
        activeResumeId ?? undefined,
      );
      setSession(result);
      setReviewed(false);
      setQuestionAnswers({});
      changeJob(
        job.id,
        result.state === "ready_for_review"
          ? "ready_for_review"
          : "in_progress",
      );
      setMessage(result.message);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to prepare application",
      );
    } finally {
      setApplyBusy(false);
    }
  }
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
  async function continueAfterChallenge() {
    if (!session) return;
    setApplyBusy(true);
    try {
      const updated = await requestApi<ApplySession>(
        "/api/apply/" + session.id + "/continue",
        {},
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
      setMessage(
        error instanceof Error ? error.message : "Challenge is not complete.",
      );
    } finally {
      setApplyBusy(false);
    }
  }
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
      const result = await requestApi<ApplySession | { closed: boolean }>(
        "/api/apply/" + session.id + "/" + (submit ? "submit" : "close"),
        submit
          ? { confirm: true, reviewed: session.reviewUrl ? reviewed : true }
          : {},
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
        setMessage("Application preview closed.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Browser action failed",
      );
    } finally {
      setApplyBusy(false);
    }
  }


  return { prepareJob, fillCustomQuestions, continueAfterChallenge, prepareAccountSignUp, setEmployerAccountStatus, finalizeApplication };
}
