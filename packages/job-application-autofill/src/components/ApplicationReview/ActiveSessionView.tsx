/* -------------------------------------------------------------------------
 * Active session view
 * ---------------------------------------------------------------------- */

import { Ref } from "react";
import { ApplicationAnswers } from "../../hooks/useApplicationAnswers";
import { routes } from "../../routes";
import { EmployerAccountSetup } from "../EmployerAccountSetup/EmployerAccountSetup";
import { ApplicationReviewData } from "../../types/feature-props";
import { ScreeningAnswerDock } from "../ScreeningAnswerDock/ScreeningAnswerDock";
import {
  ApplicationBrowserHandle,
  ApplicationBrowser,
} from "./ApplicationBrowser";
import { EmployerQuestions } from "./EmployerQuestions";

type Session = NonNullable<ApplicationReviewData["session"]>;

export function withQuery(
  base: string,
  params: Record<string, string | null | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  return `${base}?${query}`;
}

export function ActiveSessionView({
  session,
  applicationId,
  employerHost,
  controller,
  answers,
  browserRef,
}: {
  session: Session;
  applicationId: string;
  employerHost: string;
  controller: ApplicationReviewData;
  answers: ApplicationAnswers;
  browserRef: Ref<ApplicationBrowserHandle>;
}) {
  const {
    activeProfileId,
    activeResumeId,
    applyBusy,
    reviewed,
    setReviewed,
    continueAfterChallenge,
    finalizeApplication,
  } = controller;

  const isReady = session.state === "ready_for_review";
  const canSubmit = isReady && !(session.reviewUrl && !reviewed);
  const viewerHref = withQuery(routes.applicationViewer, {
    session: session.id,
    profile: activeProfileId,
  });

  return (
    <>
      <div className="panel-title">
        <h2>Application review</h2>
        {session.state !== "login_required" && <p>{session.message}</p>}
      </div>

      <div className="application-session-meta">
        <span className="application-state" data-state={session.state}>
          {session.state.replaceAll("_", " ")}
        </span>
        <span className="application-employer-host">{employerHost}</span>
        {session.ats && <span className="application-ats">{session.ats}</span>}
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
            Resume autofill
          </button>
        </div>
      )}

      {session.state === "submission_unverified" && (
        <p className="validation warning">
          Submission was attempted but the employer did not show a recognizable
          confirmation. Verify the result manually before updating the job
          status.
        </p>
      )}

      {isReady && (
        <EmployerQuestions
          busy={applyBusy}
          saving={answers.saving}
          message={answers.message}
          savedAnswers={answers.savedAnswers}
          onSave={() => void answers.saveFromEmployerForm(session.id)}
          onAutofill={continueAfterChallenge}
        />
      )}

      {isReady && session.ats && (
        <ScreeningAnswerDock
          key={session.id}
          sessionId={session.id}
          currentJobId={applicationId}
          onLibraryChanged={answers.refresh}
          profileId={activeProfileId}
          resumeId={activeResumeId ?? undefined}
          questions={session.questions ?? []}
          savedAnswers={answers.savedAnswers}
          ApplicationQnAs={answers.ApplicationQnAs}
          currentAnswerRecords={answers.currentAnswerRecords}
        />
      )}

      {session.reviewUrl && (
        <div className="browser-review employer-application">
          <div className="browser-review-header">
            <strong>Application preview</strong>
            <a
              className="browser-open"
              href={viewerHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setReviewed(false)}
            >
              Open in new window
            </a>
          </div>

          <p>
            Review the application and complete any missing information before
            submitting.
          </p>

          {session.filled?.length > 0 && (
            <p>
              <strong>Completed:</strong> {session.filled.join(", ")}
            </p>
          )}
          {session.missing?.length > 0 && (
            <p className="validation warning">
              <strong>Review manually:</strong> {session.missing.join(", ")}
            </p>
          )}

          <ApplicationBrowser
            key={session.id}
            ref={browserRef}
            sessionId={session.id}
            profileId={activeProfileId}
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
          className="primary"
          disabled={applyBusy || !canSubmit}
          onClick={() => finalizeApplication(true)}
        >
          Confirm &amp; submit
        </button>
        <button
          className="secondary"
          disabled={applyBusy}
          onClick={() => finalizeApplication(false)}
        >
          Close browser session
        </button>
      </div>

      <p className="review-note">
        Your application will only be submitted after you confirm.
      </p>
    </>
  );
}
