import { useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  FileText,
  LoaderCircle,
  MapPin,
} from "lucide-react";

import { type ApplicationBrowserHandle } from "./ApplicationBrowser";
import { JobDescription } from "../JobDescription/JobDescription";
import type { ApplicationReviewData } from "../../types/feature-props";
import "./ApplicationReview.css";
import { useApplicationAnswers } from "../../hooks/useApplicationAnswers";
import { SavedAnswers } from "./SavedAnswers";
import { ActiveSessionView, withQuery } from "./ActiveSessionView";
import { routes } from "../../routes";
import { ResumeVersion } from "../../types/api-types";
import { ApplicationStart } from "./ApplicationStart";
import { JobApplication } from "../../types/job-application";
/* -------------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------------- */

interface ApplicationReviewProps {
  controller: ApplicationReviewData;
  onChooseResume: (resumeId: string) => Promise<void>;
  resumeBusy?: boolean;
}

/* -------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------- */

const DEFAULT_EMPLOYER_HOST = "Employer website";

function getEmployerHost(...urls: Array<string | undefined>): string {
  try {
    return new URL(urls.find(Boolean) ?? "").hostname;
  } catch {
    return DEFAULT_EMPLOYER_HOST; // No employer URL yet.
  }
}

/* -------------------------------------------------------------------------
 * Presentational pieces
 * ---------------------------------------------------------------------- */

function ApplicationHeading({
  job,
  resume,
  backHref,
}: {
  job?: JobApplication;
  resume?: ResumeVersion;
  backHref: string;
}) {
  const details = job?.details;

  return (
    <header className="application-page-heading">
      <a className="application-back" href={backHref}>
        <ArrowLeft size={15} /> Applications
      </a>

      <div className="application-title-row">
        <span className="application-company-icon">
          <BriefcaseBusiness size={24} aria-hidden="true" />
        </span>
        <div>
          <p className="application-company-name">
            {job?.company || "Employer application"}
          </p>
          <h1>{job?.role || "Application"}</h1>
        </div>
      </div>

      <div className="application-context">
        {details?.location && (
          <span>
            <MapPin size={14} aria-hidden="true" />
            {details.location}
          </span>
        )}
        {details?.requisitionId && <span>{details.requisitionId}</span>}
        {details?.salary && (
          <span className="job-salary">{details.salary}</span>
        )}
        {resume && (
          <span>
            <FileText size={14} aria-hidden="true" />
            {resume.name}
          </span>
        )}
        {job?.url && (
          <a href={job.url} target="_blank" rel="noopener noreferrer">
            View job posting <ArrowUpRight size={14} />
          </a>
        )}
      </div>
    </header>
  );
}

function ApplicationLoading() {
  return (
    <div className="application-loading" role="status">
      <LoaderCircle
        size={28}
        className="application-spinner"
        aria-hidden="true"
      />
      <div>
        <h3>Opening your application…</h3>
        <p>Preparing your resume and connecting to the employer.</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Main component
 * ---------------------------------------------------------------------- */

export function ApplicationReview({
  controller,
  onChooseResume,
  resumeBusy = false,
}: ApplicationReviewProps) {
  const {
    applicationId,
    activeProfileId,
    activeResumeId,
    resumeVersions,
    jobs,
    session,
    applyBusy,
  } = controller;

  const browser = useRef<ApplicationBrowserHandle>(null);
  const answers = useApplicationAnswers(
    applicationId,
    activeProfileId,
    activeResumeId,
  );

  // Keep the in-browser menu in sync with session changes.
  useEffect(() => {
    browser.current?.refreshMenu();
  }, [session?.id, session?.state, session?.running, applyBusy]);

  const job = jobs.find((item) => item.id === applicationId);
  const selectedResume = resumeVersions.find(
    (item) => item.id === job?.resumeId,
  );
  const employerHost = getEmployerHost(session?.url, job?.url);
  const applicationsHref = withQuery(routes.applications, {
    profile: activeProfileId,
    resume: activeResumeId,
  });

  return (
    <>
      {applicationId && (
        <ApplicationHeading
          job={job}
          resume={selectedResume}
          backHref={applicationsHref}
        />
      )}

      {job?.details?.description && (
        <details className="application-job-description">
          <summary>About this role</summary>
          <JobDescription content={job.details.description} />
        </details>
      )}

      {!session && (
        <SavedAnswers
          answers={answers.savedAnswers}
          label="Saved screening responses"
          className="panel saved-application-answers"
        />
      )}

      {applicationId && !session && !applyBusy && (
        <ApplicationStart
          job={job}
          resumeVersions={resumeVersions}
          activeResumeId={activeResumeId}
          resumeBusy={resumeBusy}
          onChooseResume={onChooseResume}
          onOpen={() => job && void controller.prepareJob(job)}
        />
      )}

      {applicationId && (session || applyBusy) && (
        <div className="application-workspace">
          <section className="panel review-panel">
            {session ? (
              <ActiveSessionView
                session={session}
                applicationId={applicationId}
                employerHost={employerHost}
                controller={controller}
                answers={answers}
                browserRef={browser}
              />
            ) : (
              <ApplicationLoading />
            )}
          </section>
        </div>
      )}
    </>
  );
}
