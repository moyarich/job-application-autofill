import "./WorkspaceHeader.css";
import type { ApplicationController } from "../../utils/application/useApplication";
export function WorkspaceHeader({
  controller,
}: {
  controller: ApplicationController;
}) {
  const { tab, setTab } = controller;
  return (
    <header>
      <div>
        <div className="eyebrow">YOUR WORKSPACE</div>
        <h1>
          {tab === "profile"
            ? "My profile"
            : tab === "parser"
              ? "Resume import"
              : "Applications"}
        </h1>
        <p>
          {tab === "profile"
            ? "Keep your details and work history up to date."
            : tab === "parser"
              ? "Import a resume and review the information we find."
              : "Manage your opportunities and track each application."}
        </p>
      </div>
      <div className="actions">
        
        <button className="secondary" onClick={() => setTab("parser")}>
          Import resume
        </button>
        <button
          className="primary"
          onClick={() => {
            setTab("applications");
            document
              .getElementById("applications-list")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          View applications
        </button>
      </div>
    </header>
  );
}
