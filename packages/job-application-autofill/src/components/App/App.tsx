import "./App.css";
import { ArrowUpRight } from "lucide-react";
import { useApplication } from "../../utils/application/useApplication";
import { ApplicationReview } from "../ApplicationReview/ApplicationReview";
import { Sidebar } from "../Sidebar/Sidebar";
import { ContactImportReview } from "../ContactImportReview/ContactImportReview";
import { Applications } from "../../pages/applications/Applications";
import { Resumes } from "../../pages/resumes/Resumes";
import { ResumeEditor } from "../../pages/resumes/edit/ResumeEditor";
import { ResumeView } from "../../pages/resumes/view/ResumeView";
import { ResumeImport } from "../../pages/resumes/import/ResumeImport";
import { Profile } from "../../pages/profile/Profile";
import { Workspace } from "../../pages/workspace/Workspace";

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
          <Applications controller={controller} />
        ) : tab === "parser" ? (
          <ResumeImport controller={controller} />
        ) : tab === "view" ? (
          <ResumeView controller={controller} />
        ) : tab === "resumes" ? (
          <Resumes controller={controller} />
        ) : tab === "personal" ? (
          <Profile controller={controller} />
        ) : tab === "workspace" ? (
          <Workspace controller={controller} />
        ) : (
          <ResumeEditor controller={controller} />
        )}
        <footer>
          Review all application details before submitting.
          <ArrowUpRight size={13} aria-hidden="true" />
        </footer>
      </main>
    </div>
  );
}
