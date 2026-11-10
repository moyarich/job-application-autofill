import "./App.css";
import { useLocation, useParams } from "react-router";
import { tabForPath } from "./routes";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { PageApplications } from "./pages/applications/PageApplications";
import { PageApplicationReview } from "./pages/applications/PageApplicationReview";
import { PageResumes } from "./pages/resumes/PageResumes";
import { PageResumeEditor } from "./pages/resumes/PageResumeEditor";
import { PageResumeView } from "./pages/resumes/PageResumeView";
import { PageResumeImport } from "./pages/resumes/PageResumeImport";
import { PageProfile } from "./pages/profile/PageProfile";
import { PageContacts } from "./pages/contacts/PageContacts";
import { PageWorkspace } from "./pages/workspace/PageWorkspace";

export function App() {
  const location = useLocation();
  const applicationId = useParams().applicationId ?? null;
  const tab = tabForPath(location.pathname);

  return (
    <div className={applicationId ? "app application-page" : "app"}>
      <Sidebar />
      <main className="main">
        {applicationId ? (
          <PageApplicationReview />
        ) : tab === "applications" ? (
          <PageApplications />
        ) : tab === "parser" ? (
          <PageResumeImport />
        ) : tab === "view" ? (
          <PageResumeView />
        ) : tab === "resumes" ? (
          <PageResumes />
        ) : tab === "personal" ? (
          <PageProfile />
        ) : tab === "contacts" ? (
          <PageContacts />
        ) : tab === "workspace" ? (
          <PageWorkspace />
        ) : (
          <PageResumeEditor />
        )}
      </main>
    </div>
  );
}
