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
        <div className="eyebrow">JOB APPLICATION WORKSPACE</div>
        <h1>
          {tab === "profile"
            ? "Candidate profile"
            : tab === "parser"
              ? "Resume parser"
              : "Application tracker"}
        </h1>
        <p>
          {tab === "profile"
            ? "Maintain your structured candidate information."
            : tab === "parser"
              ? "Extract profile data from a resume file."
              : "Organize opportunities and apply to supported job boards."}
        </p>
      </div>
      <div className="actions">
        <span className="header-chip">● &nbsp; SQLite storage</span>
        <button className="secondary" onClick={() => setTab("parser")}>
          Parse resume
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
          Apply to job
        </button>
      </div>
    </header>
  );
}
