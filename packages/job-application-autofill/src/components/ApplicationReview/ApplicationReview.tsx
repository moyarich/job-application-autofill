import "./ApplicationReview.css";
import type { ApplicationController } from "../../utils/application/useApplication";
export function ApplicationReview({
  controller,
}: {
  controller: ApplicationController;
}) {
  const {
    applicationId,
    activeProfileId,
    jobs,
    session,
    applyBusy,
    continueAfterChallenge,
    questionAnswers,
    setQuestionAnswers,
    fillCustomQuestions,
    setReviewed,
    reviewed,
    finalizeApplication,
  } = controller;
  return (
    <>
      {" "}
      {applicationId && (
        <div className="application-page-heading">
          <a href="/">← Application tracker</a>
          <h2>
            {jobs.find((job) => job.id === applicationId)?.role ||
              "Application"}
          </h2>
          <p>{jobs.find((job) => job.id === applicationId)?.company}</p>
        </div>
      )}
      {applicationId && (session || applyBusy) && (
        <div className="application-workspace">
          <section className="panel review-panel">
            {session ? (
              <>
                <div className="panel-title">
                  <h2>Application review</h2>
                  <p>{session.message}</p>
                </div>
                <p>
                  <strong>Session:</strong> {session.state.replaceAll("_", " ")}{" "}
                  · {session.url}
                </p>
                {(session.state === "manual_intervention" ||
                  session.state === "login_required") && (
                  <div className="validation warning">
                    {session.state === "login_required"
                      ? "Sign in or create your account in the interactive browser viewer. Enter credentials and MFA codes only on the employer or identity provider website."
                      : "Complete the security challenge in the interactive browser viewer."}
                    <button
                      className="secondary"
                      disabled={applyBusy}
                      onClick={continueAfterChallenge}
                    >
                      I've finished — continue
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
                {session.ats && (
                  <p>
                    <strong>ATS:</strong> {session.ats}
                  </p>
                )}
                {session.state === "ready_for_review" && (
                  <div className="application-questions">
                    <div className="panel-title">
                      <h3>Employer-specific questions</h3>
                      <p>
                        Only your own answers are filled. Sensitive and
                        voluntary questions stay in the employer browser.
                      </p>
                    </div>
                    {(session.questions || [])
                      .filter(
                        (q) =>
                          !/password|passcode|otp|social security|ssn|date of birth|birth date|credit card|bank account|passport|tax id|gender|race|ethnic|disabil|veteran|sexual orientation|demographic|self.identif/i.test(
                            q.label,
                          ),
                      )
                      .map((q) => (
                        <label key={q.label}>
                          {q.label}
                          {q.required ? " (required)" : ""}
                          {q.options.length > 0 &&
                          (q.kind === "select" ||
                            q.kind === "radio" ||
                            q.kind === "combobox") ? (
                            <select
                              value={questionAnswers[q.label] || ""}
                              onChange={(e) =>
                                setQuestionAnswers((value) => ({
                                  ...value,
                                  [q.label]: e.target.value,
                                }))
                              }
                            >
                              <option value="">Select an answer</option>
                              {q.options.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : q.kind === "checkbox" ? (
                            <select
                              value={questionAnswers[q.label] || ""}
                              onChange={(e) =>
                                setQuestionAnswers((value) => ({
                                  ...value,
                                  [q.label]: e.target.value,
                                }))
                              }
                            >
                              <option value="">Select</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          ) : q.kind === "textarea" ? (
                            <textarea
                              rows={3}
                              value={questionAnswers[q.label] || ""}
                              onChange={(e) =>
                                setQuestionAnswers((value) => ({
                                  ...value,
                                  [q.label]: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <input
                              value={questionAnswers[q.label] || ""}
                              onChange={(e) =>
                                setQuestionAnswers((value) => ({
                                  ...value,
                                  [q.label]: e.target.value,
                                }))
                              }
                            />
                          )}
                        </label>
                      ))}
                    <div className="actions">
                      <button
                        className="secondary"
                        disabled={
                          applyBusy ||
                          !Object.values(questionAnswers).some(Boolean)
                        }
                        onClick={fillCustomQuestions}
                      >
                        Fill my answers
                      </button>
                      <button
                        className="secondary"
                        disabled={applyBusy}
                        onClick={continueAfterChallenge}
                      >
                        Refresh form after next step
                      </button>
                    </div>
                  </div>
                )}
                {session.reviewUrl && (
                  <div className="browser-review employer-application">
                    <div className="browser-review-header">
                      <strong>Live employer application</strong>
                      <a
                        className="browser-open"
                        href={"/application-viewer.html?session=" + session.id + "&profile=" + encodeURIComponent(activeProfileId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setReviewed(false)}
                      >
                        Open in full window ↗
                      </a>
                    </div>
                    <p>
                      The browser connects using your local viewer
                      configuration. Review every field and complete any missing
                      questions before submitting.
                    </p>
                    {session.filled?.length > 0 && (
                      <p>
                        <strong>Prepared:</strong> {session.filled.join(", ")}
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
                      src={"/application-viewer.html?session=" + session.id}
                      allow="clipboard-read; clipboard-write"
                      referrerPolicy="no-referrer"
                    />
                    <label className="review-checkbox">
                      <input
                        type="checkbox"
                        checked={reviewed}
                        onChange={(event) => setReviewed(event.target.checked)}
                      />{" "}
                      I inspected the live application and reviewed all fields.
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
                  Review the actual Playwright browser window and answer any
                  required questions before submitting. Submission is never
                  automatic.
                </p>
              </>
            ) : (
              <div className="application-loading" role="status">
                <h3>Opening your application…</h3>
                <p>Preparing your résumé and connecting to the employer.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
