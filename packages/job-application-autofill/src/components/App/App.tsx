import "./App.css";
import { ArrowUpRight, CheckCircle2, Clock3, ListChecks, MessageCircle } from "lucide-react";
import { useApplication } from "../../utils/application/useApplication";
import { ResumeParser } from "../ResumeParser/ResumeParser";
import { CandidateProfile } from "../CandidateProfile/CandidateProfile";
import { ApplicationReview } from "../ApplicationReview/ApplicationReview";
import { Opportunities } from "../Opportunities/Opportunities";
import { Sidebar } from "../Sidebar/Sidebar";
import { WorkspaceHeader } from "../WorkspaceHeader/WorkspaceHeader";
import { ContactImportReview } from "../ContactImportReview/ContactImportReview";
import { LocalProfiles } from "../LocalProfiles/LocalProfiles";
import { ContactManager } from "../ContactManager/ContactManager";
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
      <Sidebar />
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
        <ContactImportReview controller={controller} />
        {tab === "applications" ? (
          <>
            <section className="stats" aria-label="Application overview">
              <div className="stat"><span><ListChecks size={15} aria-hidden="true" /> Total applications</span><strong>{jobs.length}</strong></div>
              <div className="stat"><span><Clock3 size={15} aria-hidden="true" /> In progress</span>
                <strong>{jobs.filter(job => job.status === "in_progress" || job.status === "ready_for_review").length}</strong></div>
              <div className="stat"><span><CheckCircle2 size={15} aria-hidden="true" /> Submitted</span>
                <strong>{jobs.filter(job => job.status === "submitted").length}</strong></div>
              <div className="stat"><span><MessageCircle size={15} aria-hidden="true" /> Interviews</span>
                <strong>{jobs.filter(job => job.status === "interview").length}</strong></div>
            </section>
            <ApplicationReview controller={controller} />
            <Opportunities controller={controller} />
          </>
        ) : tab === "parser" ? (
          <ResumeParser controller={controller} />
        ) : tab === "workspace" ? (
          <>
          <section className="panel workspace-management">
            <div className="panel-title">
              <h2>Manage profiles and resumes</h2>
              <p>Switch between profiles, create resume versions, and manage saved records.</p>
            </div>
            <LocalProfiles controller={controller} />
          </section>
          <ContactManager controller={controller} />
          </>
        ) : (
          <CandidateProfile controller={controller} />
        )}
        <footer>Review all application details before submitting. <ArrowUpRight size={13} aria-hidden="true" /></footer>
      </main>
    </div>
  );
}
