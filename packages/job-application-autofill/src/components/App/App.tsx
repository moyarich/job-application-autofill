import "./App.css";
import { ArrowUpRight } from "lucide-react";
import { useWorkspace } from "../../hooks/useWorkspace";
import { Sidebar } from "../Sidebar/Sidebar";
import { PageApplications } from "../../pages/applications/PageApplications";
import { PageApplicationReview } from "../../pages/applications/PageApplicationReview";
import { PageResumes } from "../../pages/resumes/PageResumes";
import { PageResumeEditor } from "../../pages/resumes/PageResumeEditor";
import { PageResumeView } from "../../pages/resumes/PageResumeView";
import { PageResumeImport } from "../../pages/resumes/PageResumeImport";
import { PageProfile } from "../../pages/profile/PageProfile";
import { PageWorkspace } from "../../pages/workspace/PageWorkspace";

export function App() {
  const workspace = useWorkspace();
  const { applicationId, tab, hydrated, message, setMessage } = workspace;

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
        {applicationId ? (
          <PageApplicationReview workspace={workspace} />
        ) : tab === "applications" ? (
          <PageApplications workspace={workspace} />
        ) : tab === "parser" ? (
          <PageResumeImport workspace={workspace} />
        ) : tab === "view" ? (
          <PageResumeView workspace={workspace} />
        ) : tab === "resumes" ? (
          <PageResumes workspace={workspace} />
        ) : tab === "personal" ? (
          <PageProfile workspace={workspace} />
        ) : tab === "workspace" ? (
          <PageWorkspace workspace={workspace} />
        ) : (
          <PageResumeEditor workspace={workspace} />
        )}
        <footer>
          Review all application details before submitting.
          <ArrowUpRight size={13} aria-hidden="true" />
        </footer>
      </main>
    </div>
  );
}
