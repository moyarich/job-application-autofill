import "./ApplicationReview.css";
import { EmployerAccountSetup } from "../EmployerAccountSetup/EmployerAccountSetup";
import { AutomationPillMenu, type AutomationAction } from "../AutomationPillMenu/AutomationPillMenu";
import type { ApplicationController } from "../../utils/application/useApplication";
export function ApplicationReview({
  controller,
}: {
  controller: ApplicationController;
}) {
  const {
    applicationId,
    activeProfileId,
    activeResumeId,
    jobs,
    session,
    applyBusy,
    continueAfterChallenge,
    prepareAccountSignUp,
    questionAnswers,
    setQuestionAnswers,
    fillCustomQuestions,
    setReviewed,
    reviewed,
    finalizeApplication,
  } = controller;
  return (
    <>
      {applicationId && (
        <div className="application-page-heading">
          <a href={"/applications?profile=" + encodeURIComponent(activeProfileId) + (activeResumeId ? "&resume=" + encodeURIComponent(activeResumeId) : "")}>← Back to applications</a>
          <h2>
            {jobs.find((job) => job.id === applicationId)?.role ||
              "Application"}
          </h2>
          <p>{jobs.find((job) => job.id === applicationId)?.company}</p>
        </div>
      )}
      {applicationId && !session && !applyBusy && (
        <section className="panel">
          <h3>Start this application</h3>
          <p>Open the employer form with the selected resume and contact details.</p>
          <button className="primary" onClick={() => {
            const job = jobs.find(item => item.id === applicationId);
            if (job) void controller.prepareJob(job);
          }}>Open employer application</button>
        </section>
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
                  <strong>Status:</strong> {session.state.replaceAll("_", " ")}{" "}
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
                {session.state !== "preparing" && <EmployerAccountSetup controller={controller} />}
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
                      <h3>Application questions</h3>
                      <p>
                        Use Autofill this step after moving to another page in the employer form. Review these questions and enter your answers. Sensitive questions remain on the employer’s site.
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
                        Autofill this step
                      </button>
                    </div>
                  </div>
                )}
                {session.reviewUrl && (
                  <div className="browser-review employer-application">
                    <div className="browser-review-header">
                      <strong>Application preview</strong>
                      <a
                        className="browser-open"
                        href={"/application-viewer.html?session=" + session.id + "&profile=" + encodeURIComponent(activeProfileId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setReviewed(false)}
                      >
                        Open in new window
                      </a>
                    </div>
                    <p>
                      Review the application and complete any missing information before submitting.
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
                      src={"/application-viewer.html?session=" + session.id + "&profile=" + encodeURIComponent(activeProfileId)}
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
                {session.reviewUrl && (
                  <AutomationPillMenu busy={applyBusy} status={session.ats ? "ATS: " + session.ats : "Application session connected"}
                    actions={[
                      { id: "detect", label: "Detect current page", description: "Dedicated page detection is not configured", available: false },
                      { id: "register", label: "Create account", description: "Prepare employer registration fields",
                        available: !applyBusy && session.state !== "preparing",
                        onSelect: () => prepareAccountSignUp() },
                      { id: "sign-in", label: "Sign in", description: "Sign in manually in the employer browser", available: false },
                      { id: "contact", label: "Contact autofill", description: "A dedicated contact-only action is not configured", available: false },
                      { id: "employment", label: "Employment autofill", description: "A dedicated employment-only action is not configured", available: false },
                      { id: "education", label: "Education autofill", description: "A dedicated education-only action is not configured", available: false },
                      { id: "resume", label: "Upload resume", description: "Upload runs during supported application autofill", available: false },
                      { id: "questions", label: "Screening questions", description: "Fill the answers entered in Application review",
                        available: !applyBusy && session.state === "ready_for_review" && Object.values(questionAnswers).some(Boolean),
                        onSelect: fillCustomQuestions },
                      { id: "next", label: "Autofill current step", description: "Rerun supported form automation on the open page",
                        available: !applyBusy && ["ready_for_review", "login_required", "manual_intervention"].includes(session.state),
                        onSelect: continueAfterChallenge },
                    ] satisfies AutomationAction[]}
                  />
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
                <h3>Opening your application…</h3>
                <p>Preparing your resume and connecting to the employer.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
