import "./App.css";
import { useApplication } from "../../utils/application/useApplication";
import { ResumeParser } from "../ResumeParser/ResumeParser";
import { CandidateProfile } from "../CandidateProfile/CandidateProfile";
import { ApplicationReview } from "../ApplicationReview/ApplicationReview";
import { Opportunities } from "../Opportunities/Opportunities";
import { Sidebar } from "../Sidebar/Sidebar";
import { WorkspaceHeader } from "../WorkspaceHeader/WorkspaceHeader";
export function App() {
  const controller = useApplication();
  const { applicationId, tab, jobs, hydrated, message, setMessage } =
    controller;

  if (!hydrated)
    return (
      <div className={applicationId ? "app application-page" : "app"}>
        <main className="main">
          <h1>Opening your workspace</h1>
          <p>{message || "Loading your information..."}</p>
        </main>
      </div>
    );
  return (
    <div className={applicationId ? "app application-page" : "app"}>
      <Sidebar controller={controller} />
      <main className="main">
        <WorkspaceHeader controller={controller} />
        {message && (
          <div className="notice" role="status">
            {message}
            <button
              onClick={() => setMessage("")}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}
        {tab === "applications" ? (
          <>
            <section className="stats">
              <div className="stat">
                <span>Total applications</span>
                <strong>{jobs.length}</strong>
              </div>
              <div className="stat">
                <span>In progress</span>
                <strong>
                  {
                    jobs.filter(
                      (x) =>
                        x.status === "in_progress" ||
                        x.status === "ready_for_review",
                    ).length
                  }
                </strong>
              </div>
              <div className="stat">
                <span>Submitted</span>
                <strong>
                  {jobs.filter((x) => x.status === "submitted").length}
                </strong>
              </div>
              <div className="stat">
                <span>Interviews</span>
                <strong>
                  {jobs.filter((x) => x.status === "interview").length}
                </strong>
              </div>
            </section>
            <ResumeParser controller={controller} />
            <ApplicationReview controller={controller} />
            <Opportunities controller={controller} />
          </>
        ) : tab === "parser" ? (
          <ResumeParser controller={controller} />
        ) : (
          <CandidateProfile controller={controller} />
        )}
        <footer>Applications stay under your control. Always review before submitting.</footer>
      </main>
    </div>
  );
}
