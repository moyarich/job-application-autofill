import { applicationReviewPath } from "../../routes";
import { JobApplication } from "../../types/job-application";

/** Open the review workflow without making job-tracker pages own review state. */
export function openApplication(
  job: JobApplication,
  profileId: string,
  resumeId: string | null,
  target?: Window | null,
) {
  const url = new URL(window.location.href);
  url.pathname = applicationReviewPath(job.id);
  url.search = "";
  url.searchParams.set("profile", profileId);
  if (resumeId) url.searchParams.set("resume", resumeId);
  url.searchParams.set("start", "1");
  if (target) target.location.href = url.href;
  else if (target === null) window.location.assign(url.href);
  else window.open(url.href, "application-" + job.id);
}
