import "./App.css";
import { ArrowUpRight } from "lucide-react";
import { useApplication } from "../../hooks/useApplication";
import { ApplicationReview } from "../ApplicationReview/ApplicationReview";
import { Sidebar } from "../Sidebar/Sidebar";
import { ContactImportReview } from "../ContactImportReview/ContactImportReview";
import { PageApplications } from "../../pages/applications/PageApplications";
import { PageResumes } from "../../pages/resumes/PageResumes";
import { PageResumeEditor } from "../../pages/resumes/PageResumeEditor";
import { PageResumeView } from "../../pages/resumes/PageResumeView";
import { PageResumeImport } from "../../pages/resumes/PageResumeImport";
import { PageProfile } from "../../pages/profile/PageProfile";
import { PageWorkspace } from "../../pages/workspace/PageWorkspace";

export function App() {
  const controller = useApplication();
  const { applicationId, tab, hydrated, message, setMessage } = controller;

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
        {!applicationId && <ContactImportReview controller={controller} />}
        {applicationId ? (
          <ApplicationReview controller={controller} />
        ) : tab === "applications" ? (
          <PageApplications controller={controller} />
        ) : tab === "parser" ? (
          <PageResumeImport controller={controller} />
        ) : tab === "view" ? (
          <PageResumeView controller={controller} />
        ) : tab === "resumes" ? (
          <PageResumes controller={controller} />
        ) : tab === "personal" ? (
          <PageProfile controller={controller} />
        ) : tab === "workspace" ? (
          <PageWorkspace controller={controller} />
        ) : (
          <PageResumeEditor controller={controller} />
        )}
        <footer>
          Review all application details before submitting.
          <ArrowUpRight size={13} aria-hidden="true" />
        </footer>
      </main>
    </div>
  );
}
