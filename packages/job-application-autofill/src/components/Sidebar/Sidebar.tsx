import "./Sidebar.css";
import type { ApplicationController } from "../../utils/application/useApplication";
export function Sidebar({ controller }: { controller: ApplicationController }) {
  const { tab, setTab } = controller;
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-symbol">J</span>
        <span>
          job-application-<span className="brand-light">autofill</span>
        </span>
      </div>
      <div className="nav-label">WORKSPACE</div>
      <button
        className={tab === "applications" ? "nav active" : "nav"}
        onClick={() => setTab("applications")}
      >
        ◫ &nbsp; Applications
      </button>
      <button
        className={tab === "profile" ? "nav active" : "nav"}
        onClick={() => setTab("profile")}
      >
        ♙ &nbsp; Candidate profile
      </button>
      <button
        className={tab === "parser" ? "nav active" : "nav"}
        onClick={() => setTab("parser")}
      >
        ⇧ &nbsp; Resume parser
      </button>
      <div className="sidebar-bottom">
        Local-first prototype
        <br />
        React + TypeScript
        <br />
        <span>v0.1 foundation</span>
      </div>
    </aside>
  );
}
