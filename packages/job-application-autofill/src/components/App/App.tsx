import "./App.css";
import { ArrowUpRight } from "lucide-react";
import { useApplication } from "../../utils/application/useApplication";
import { ApplicationReview } from "../ApplicationReview/ApplicationReview";
import { Sidebar } from "../Sidebar/Sidebar";
import { ContactImportReview } from "../ContactImportReview/ContactImportReview";
import { ApplicationsPage } from "../../pages/applications/ApplicationsPage";
import { ResumesPage } from "../../pages/resumes/ResumesPage";
import { ResumeEditorPage } from "../../pages/resumes/edit/ResumeEditorPage";
import { ResumeViewPage } from "../../pages/resumes/view/ResumeViewPage";
import { ResumeImportPage } from "../../pages/resumes/import/ResumeImportPage";
import { ProfilePage } from "../../pages/profile/ProfilePage";
import { WorkspacePage } from "../../pages/workspace/WorkspacePage";

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
          <ApplicationsPage controller={controller} />
        ) : tab === "parser" ? (
          <ResumeImportPage controller={controller} />
        ) : tab === "view" ? (
          <ResumeViewPage controller={controller} />
        ) : tab === "resumes" ? (
          <ResumesPage controller={controller} />
        ) : tab === "personal" ? (
          <ProfilePage controller={controller} />
        ) : tab === "workspace" ? (
          <WorkspacePage controller={controller} />
        ) : (
          <ResumeEditorPage controller={controller} />
        )}
        <footer>
          Review all application details before submitting.
          <ArrowUpRight size={13} aria-hidden="true" />
        </footer>
      </main>
    </div>
  );
}
