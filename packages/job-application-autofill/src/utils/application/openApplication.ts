import type { JobApplication } from "../../index";

/** Open the review workflow without making job-tracker pages own review state. */
export function openApplication(job: JobApplication, profileId: string, resumeId: string | null) {
  const url = new URL(window.location.href);
  url.pathname = "/apply/" + encodeURIComponent(job.id);
  url.search = "";
  url.searchParams.set("profile", profileId);
  if (resumeId) url.searchParams.set("resume", resumeId);
  window.open(url.href, "application-" + job.id);
}
