import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import {
  BriefcaseBusiness,
  FileText,
  FileUp,
  Menu,
  UserRound,
  X,
} from "lucide-react";
import "./Sidebar.css";

const menuGroups = [
  {
    label: "Job search",
    pages: [
      { path: "/applications", label: "Applications", icon: BriefcaseBusiness },
    ],
  },
  {
    label: "Resumes",
    pages: [
      { path: "/resumes", label: "Resumes", icon: FileText },
      { path: "/resumes/import", label: "Import resume", icon: FileUp },
    ],
  },
  {
    label: "Profile",
    pages: [{ path: "/profile", label: "Profile & contacts", icon: UserRound }],
  },
] as const;

export function Sidebar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  // Only profile/resume selection belongs across the application and resume pages.
  // Don't propagate unrelated route parameters to other pages.
  const currentParams = new URLSearchParams(location.search);
  const pageParams = new URLSearchParams();
  for (const key of ["profile", "resume"]) {
    const value = currentParams.get(key);
    if (value) pageParams.set(key, value);
  }
  const pageSearch = pageParams.toString();
  return (
    <aside className={menuOpen ? "sidebar sidebar-open" : "sidebar"}>
      <div className="sidebar-header">
        <div className="brand" aria-label="job-application-autofill">
          <span className="brand-symbol" aria-hidden="true">
            <BriefcaseBusiness size={19} strokeWidth={2.2} />
          </span>
          <span className="brand-name">Job Application<span className="brand-light"> Autofill</span></span>
        </div>
        <button
          className="sidebar-toggle"
          type="button"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          aria-controls="sidebar-content"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      <div id="sidebar-content" className="sidebar-content">
        <nav className="sidebar-navigation" aria-label="Main navigation">
          {menuGroups.map((group) => (
            <div
              className="sidebar-menu-group"
              key={group.label}
              role="group"
              aria-label={group.label}
            >
              <span className="nav-label">{group.label}</span>
              {group.pages.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={{ pathname: path, search: pageSearch }}
                  end={path === "/resumes" && !/^\/resumes\/(?:edit|view)/.test(location.pathname)}
                  className={({ isActive }) =>
                    isActive ? "nav active" : "nav"
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
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
