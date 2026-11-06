import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import { BriefcaseBusiness, FileText, FolderOpen, Menu, UserRound, X } from "lucide-react";
import "./Sidebar.css";

const pages = [
  { path: "/applications", label: "Applications", icon: BriefcaseBusiness },
  { path: "/profile", label: "Resume editor", icon: UserRound },
  { path: "/import", label: "Resume import", icon: FileText },
  { path: "/workspace", label: "Profiles & resumes", icon: FolderOpen },
] as const;

export function Sidebar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <aside className={menuOpen ? "sidebar sidebar-open" : "sidebar"}>
      <div className="sidebar-header">
        <div className="brand" aria-label="Job Application Autofill">
          <span className="brand-symbol" aria-hidden="true"><BriefcaseBusiness size={19} strokeWidth={2.2} /></span>
          <span className="brand-name">Job Application<span className="brand-light"> Autofill</span></span>
        </div>
        <button className="sidebar-toggle" type="button"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen} aria-controls="sidebar-content"
          onClick={() => setMenuOpen(open => !open)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      <div id="sidebar-content" className="sidebar-content">
        <nav className="sidebar-navigation" aria-label="Main navigation">
          <span className="nav-label">Pages</span>
          {pages.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={{ pathname: path, search: location.search }}
              className={({ isActive }) => isActive ? "nav active" : "nav"}
              onClick={() => setMenuOpen(false)}>
              <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="sidebar-privacy-dot" aria-hidden="true" />
          Your workspace is saved on this device
        </div>
      </div>
    </aside>
  );
}
