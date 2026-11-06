import { ArrowRight, FileUp } from "lucide-react";
import "./WorkspaceHeader.css";
import type { ApplicationController } from "../../utils/application/useApplication";

export function WorkspaceHeader({ controller }: { controller: ApplicationController }) {
  const { tab, setTab } = controller;
  const content = {
    view: { title: "View resume", description: "Review your resume and export it in the format you need." },
    resumes: { title: "Resumes", description: "Your experience, tailored for every opportunity. Manage all your resume versions here." },
    applications: { title: "Applications", description: "Organize your job search and keep every application on track." },
    personal: { title: "Profile", description: "Manage your saved contact details and the profile you are working with." },
    profile: { title: "Resume editor", description: "Manage your contact details, experience, and resume versions." },
    parser: { title: "Import a resume", description: "Bring in a PDF, Word document, or resume JSON to get started." },
    workspace: { title: "Profiles & resumes", description: "Manage profiles and the resumes associated with each profile." },
  } as const;
  const current = content[tab as keyof typeof content] ?? content.applications;
  return (
    <header className="workspace-header">
      <div>
        <div className="eyebrow">Workspace / {current.title}</div>
        <h1>{current.title}</h1>
        <p>{current.description}</p>
      </div>
      <div className="actions">
        {tab !== "parser" && (
          <button type="button" className="secondary" onClick={() => setTab("parser")}>
            <FileUp size={16} /> Import resume
          </button>
        )}
        {tab !== "applications" && (
          <button type="button" className="primary" onClick={() => setTab("applications")}>
            View applications <ArrowRight size={16} />
          </button>
        )}
        {tab === "applications" && (
          <button type="button" className="primary" onClick={() => document.getElementById("add-application")?.scrollIntoView({behavior:"smooth"})}>
            Add application <ArrowRight size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
