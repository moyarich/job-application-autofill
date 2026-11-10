import { useEffect, useState } from "react";
import { requestApi } from "../../utils/api/client";
import { JobDescription } from "../JobDescription/JobDescription";
import {
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  MapPin,
  FileText,
  LoaderCircle,
} from "lucide-react";
import type { ApplicationReviewData } from "../feature-props";
import { routes } from "../../routes";
import "./ApplicationReview.css";
import { EmployerAccountSetup } from "../EmployerAccountSetup/EmployerAccountSetup";
import { ScreeningAnswerDock } from "../ScreeningAnswerDock/ScreeningAnswerDock";

export function ApplicationReview({
  controller,
  onChooseResume,
  resumeBusy = false,
}: {
  controller: ApplicationReviewData;
  onChooseResume: (resumeId: string) => Promise<void>;
  resumeBusy?: boolean;
}) {
  const {
    applicationId,
    activeProfileId,
    activeResumeId,
    resumeVersions,
    jobs,
    session,
    applyBusy,
    continueAfterChallenge,
    setReviewed,
    reviewed,
    finalizeApplication,
  } = controller;
  const [savingAnswers, setSavingAnswers] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string>>({});
  const [answerMessage, setAnswerMessage] = useState("");
  useEffect(() => {
    if (!applicationId) return;
    let cancelled = false;
    fetch("/api/applications/" + encodeURIComponent(applicationId) + "/answers", {
      headers: { "X-Moya-Client": "dashboard", "X-Profile-Id": activeProfileId },
    }).then((response) => response.ok ? response.json() : null)
      .then((data: { answers?: Record<string, string> } | null) => {
        if (!cancelled && data?.answers) setSavedAnswers(data.answers);
      }).catch(() => {});
    return () => { cancelled = true; };
  }, [applicationId, activeProfileId]);
  async function saveEmployerAnswers() {
    if (!session) return;
    setSavingAnswers(true);
    try {
      const result = await requestApi<{ answers: Record<string, string>; count: number }>(
        "/api/apply/" + session.id + "/save-answers", {}, activeProfileId,
        activeResumeId ?? undefined,
      );
      setSavedAnswers(result.answers);
      setAnswerMessage(result.count
        ? "Saved answers from the employer form to this application."
        : "No completed custom answers detected on the current employer page.");
    } catch (error) {
      setAnswerMessage(error instanceof Error ? error.message : "Unable to save answers.");
    } finally {
      setSavingAnswers(false);
    }
  }
  const job = jobs.find((item) => item.id === applicationId);
  const selectedResume = resumeVersions.find(
    (item) => item.id === job?.resumeId,
  );
  let employerHost = "Employer website";
  try {
    employerHost = new URL(session?.url || job?.url || "").hostname;
  } catch {
    /* No employer URL yet. */
  }
  return (
    <>
      {applicationId && (
        <header className="application-page-heading">
          <a
            className="application-back"
            href={
              routes.applications +
              "?profile=" +
              encodeURIComponent(activeProfileId) +
              (activeResumeId
                ? "&resume=" + encodeURIComponent(activeResumeId)
                : "")
            }
          >
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
            {job?.details?.location && (
              <span>
                <MapPin size={14} aria-hidden="true" />
                {job.details.location}
              </span>
            )}
            {job?.details?.requisitionId && (
              <span>{job.details.requisitionId}</span>
            )}
            {job?.details?.salary && (
              <span className="job-salary">{job.details.salary}</span>
            )}
            {selectedResume && (
              <span>
                <FileText size={14} aria-hidden="true" />
                {selectedResume.name}
              </span>
            )}
            {job?.url && (
              <a href={job.url} target="_blank" rel="noopener noreferrer">
                View job posting <ArrowUpRight size={14} />
              </a>
            )}
          </div>
        </header>
      )}
      {job?.details?.description && (
        <details className="application-job-description">
          <summary>About this role</summary>
          <JobDescription content={job.details.description} />
        </details>
      )}
      {Object.keys(savedAnswers).length > 0 && !session && (
        <details className="panel saved-application-answers">
          <summary>Saved screening responses ({Object.keys(savedAnswers).length})</summary>
          {Object.entries(savedAnswers).map(([question, answer]) => (
            <div key={question}><strong>{question}</strong><p>{answer}</p></div>
          ))}
        </details>
      )}
      {applicationId && !session && !applyBusy && (
        <section className="panel application-start">
          <div className="application-start-heading">
            <span className="application-step">1</span>
            <div>
              <h2>Choose your resume</h2>
              <p>
                Confirm the version to share with{" "}
                {job?.company || "this employer"}.
              </p>
            </div>
          </div>
          <div className="application-start-controls">
            <label className="application-resume-selector">
              Resume for this application
              <select
                aria-label="Resume for this application"
                disabled={resumeBusy}
                value={
                  jobs.find((item) => item.id === applicationId)?.resumeId ?? ""
                }
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
              disabled={
                resumeBusy ||
                !activeResumeId ||
                job?.resumeId !== activeResumeId
              }
              onClick={() => {
                const job = jobs.find((item) => item.id === applicationId);
                if (job) void controller.prepareJob(job);
              }}
            >
              {resumeBusy ? "Saving resume…" : "Open employer application"}
              <ArrowUpRight size={16} />
            </button>
          </div>
          <p className="application-start-note">
            {job?.accountAction === "login" ? "Log in" : "Sign up"} using
            configured account details.
          </p>
          <p className="application-start-note">
            Your application opens in an interactive browser. Review the filled
            details before submitting.
          </p>
        </section>
      )}
      {applicationId && (session || applyBusy) && (
        <div className="application-workspace">
          <section className="panel review-panel">
            {session ? (
              <>
                <div className="panel-title">
                  <h2>Application review</h2>
                  {session.state !== "login_required" && (
                    <p>{session.message}</p>
                  )}
                </div>
                <div className="application-session-meta">
                  <span
                    className="application-state"
                    data-state={session.state}
                  >
                    {session.state.replaceAll("_", " ")}
                  </span>
                  <span className="application-employer-host">
                    {employerHost}
                  </span>
                  {session.ats && (
                    <span className="application-ats">{session.ats}</span>
                  )}
                </div>
                {session.state === "login_required" && (
                  <EmployerAccountSetup controller={controller} />
                )}
                {session.state === "manual_intervention" && (
                  <div className="validation warning">
                    Complete the security check in the browser below.
                    <button
                      className="primary"
                      disabled={applyBusy}
                      onClick={continueAfterChallenge}
                    >
                      Continue
                    </button>
                  </div>
                )}
                {session.state === "submission_unverified" && (
                  <p className="validation warning">
                    Submission was attempted but the employer did not show a
                    recognizable confirmation. Verify the result manually before
                    updating the job status.
                  </p>
                )}
                {session.state === "ready_for_review" && (
                  <div className="application-questions">
                    <div className="panel-title">
                      <h3>Employer questions</h3>
                      <p>Answer any custom questions directly in the employer application below. Save the completed answers with this application; they are never reused for other jobs.</p>
                    </div>
                    <div className="actions">
                      <button type="button" className="secondary"
                        disabled={applyBusy || savingAnswers} onClick={() => void saveEmployerAnswers()}>
                        {savingAnswers ? "Saving answers…" : "Save answers from employer form"}
                      </button>
                      <button type="button" className="secondary"
                        disabled={applyBusy || savingAnswers} onClick={continueAfterChallenge}>
                        Autofill this step
                      </button>
                    </div>
                    {answerMessage && <p role="status">{answerMessage}</p>}
                    {Object.keys(savedAnswers).length > 0 && (
                      <details className="saved-application-answers">
                        <summary>Saved responses ({Object.keys(savedAnswers).length})</summary>
                        {Object.entries(savedAnswers).map(([question, answer]) => (
                          <div key={question}>
                            <strong>{question}</strong>
                            <p>{answer}</p>
                          </div>
                        ))}
                      </details>
                    )}
                  </div>
                )}
                {session.state === "ready_for_review" && session.ats === "workday" &&
                  session.questions?.length > 0 && (
                    <ScreeningAnswerDock
                      key={session.id}
                      sessionId={session.id}
                      profileId={activeProfileId}
                      resumeId={activeResumeId ?? undefined}
                      questions={session.questions}
                      savedAnswers={savedAnswers}
                    />
                  )}
                {session.reviewUrl && (
                  <div className="browser-review employer-application">
                    <div className="browser-review-header">
                      <strong>Application preview</strong>
                      <a
                        className="browser-open"
                        href={
                          routes.applicationViewer +
                          "?session=" +
                          session.id +
                          "&profile=" +
                          encodeURIComponent(activeProfileId)
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setReviewed(false)}
                      >
                        Open in new window
                      </a>
                    </div>
                    <p>
                      Review the application and complete any missing
                      information before submitting.
                    </p>
                    {session.filled?.length > 0 && (
                      <p>
                        <strong>Completed:</strong> {session.filled.join(", ")}
                      </p>
                    )}
                    {session.missing?.length > 0 && (
                      <p className="validation warning">
                        <strong>Review manually:</strong>{" "}
                        {session.missing.join(", ")}
                      </p>
                    )}
                    <iframe
                      className="browser-viewer"
                      title="Interactive Playwright application browser"
                      src={
                        routes.applicationViewer +
                        "?session=" +
                        session.id +
                        "&profile=" +
                        encodeURIComponent(activeProfileId)
                      }
                      allow="clipboard-read; clipboard-write"
                      referrerPolicy="no-referrer"
                    />
                    <label className="review-checkbox">
                      <input
                        type="checkbox"
                        checked={reviewed}
                        onChange={(event) => setReviewed(event.target.checked)}
                      />{" "}
                      I have reviewed the application details.
                    </label>
                  </div>
                )}
                <div className="actions">
                  <button
                    disabled={
                      applyBusy ||
                      session.state !== "ready_for_review" ||
                      Boolean(session.reviewUrl && !reviewed)
                    }
                    className="primary"
                    onClick={() => finalizeApplication(true)}
                  >
                    Confirm & submit
                  </button>
                  <button
                    disabled={applyBusy}
                    className="secondary"
                    onClick={() => finalizeApplication(false)}
                  >
                    Close browser session
                  </button>
                </div>
                <p className="review-note">
                  Your application will only be submitted after you confirm.
                </p>
              </>
            ) : (
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
            )}
          </section>
        </div>
      )}
    </>
  );
}
