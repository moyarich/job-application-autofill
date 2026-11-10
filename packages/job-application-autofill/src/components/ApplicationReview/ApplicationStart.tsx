import { ArrowUpRight } from "lucide-react";

import { ResumeVersion } from "../../types/api-types";

import { JobApplication } from "../../types/job-application";

const RESUMABLE_STATUSES = ["in_progress", "ready_for_review"];

const isResumable = (job?: JobApplication) =>
  !!job && RESUMABLE_STATUSES.includes(job.status);

export interface ApplicationStartProps {
  job?: JobApplication;
  resumeVersions: ResumeVersion[];
  activeResumeId?: string | null;
  resumeBusy: boolean;
  onChooseResume: (resumeId: string) => Promise<void>;
  onOpen: () => void;
}

export function ApplicationStart({
  job,
  resumeVersions,
  activeResumeId,
  resumeBusy,
  onChooseResume,
  onOpen,
}: ApplicationStartProps) {
  const resumable = isResumable(job);
  const resumeMismatch = !activeResumeId || job?.resumeId !== activeResumeId;

  return (
    <section className="panel application-start">
      <div className="application-start-heading">
        <span className="application-step">1</span>
        <div>
          <h2>
            {resumable ? "Continue your application" : "Choose your resume"}
          </h2>
          <p>
            Confirm the version to share with {job?.company || "this employer"}.
          </p>
        </div>
      </div>

      <div className="application-start-controls">
        <label className="application-resume-selector">
          Resume for this application
          <select
            aria-label="Resume for this application"
            disabled={resumeBusy}
            value={job?.resumeId ?? ""}
            onChange={(event) => void onChooseResume(event.target.value)}
          >
            <option value="">Select a resume</option>
            {resumeVersions.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.name}
              </option>
            ))}
          </select>
        </label>

        <button
          className="primary"
          disabled={resumeBusy || resumeMismatch}
          onClick={onOpen}
        >
          {resumeBusy
            ? "Saving resume…"
            : resumable
              ? "Reopen employer application"
              : "Open employer application"}
          <ArrowUpRight size={16} />
        </button>
      </div>

      <p className="application-start-note">
        {job?.accountAction === "login" ? "Log in" : "Sign up"} using configured
        account details.
      </p>
      <p className="application-start-note">
        Your application opens in an interactive browser. Review the filled
        details before submitting.
      </p>
    </section>
  );
}
