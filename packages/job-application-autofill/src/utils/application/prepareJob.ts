import { parseResumeJson } from "@moyarich/resume/validate";

import type { ApplicationReviewActionsContext } from "../../types/application-review-actions-context";

import { generateResumePdf } from "../../api/resumes";
import { prepareApplicationSession } from "../../api/applications";
import { filePayload } from "../files/resume-files";
import { JobApplication } from "../../types/job-application";

/** prepareJob action; no React hooks or state ownership. */
export function createPrepareJob(context: ApplicationReviewActionsContext) {
  const {
    applicationId,
    activeProfileId,
    activeResumeId,
    profile,
    contactId,
    errors,
    session,
    setTab,
    changeJob,
    setMessage,
    setApplyBusy,
    setSession,
    setReviewed,
  } = context;
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
    if (!activeResumeId || (job.resumeId && job.resumeId !== activeResumeId)) {
      setMessage(
        "Select the resume assigned to this application before starting.",
      );
      return;
    }
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
      const validProfile = parseResumeJson(JSON.stringify(profile));
      const generated = await generateResumePdf(validProfile, activeProfileId, activeResumeId ?? undefined);
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
      const result = await prepareApplicationSession({
          jobUrl: job.url,
          jobId: job.id,
          profile: validProfile,
          resume: upload,
        }, activeProfileId, activeResumeId ?? undefined);
      setSession(result);
      setReviewed(false);
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
  return prepareJob;
}
