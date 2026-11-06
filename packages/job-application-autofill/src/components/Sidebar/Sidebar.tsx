import { useState } from "react";
import { BriefcaseBusiness, FileText, Menu, UserRound, X } from "lucide-react";
import "./Sidebar.css";
import type { ApplicationController } from "../../utils/application/useApplication";
import { LocalProfiles } from "../LocalProfiles/LocalProfiles";

const navigation = [
  { id: "applications", label: "Applications", icon: BriefcaseBusiness },
  { id: "profile", label: "My profile", icon: UserRound },
  { id: "parser", label: "Resume import", icon: FileText },
] as const;

export function Sidebar({ controller }: { controller: ApplicationController }) {
  const { tab, setTab } = controller;
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <aside className={menuOpen ? "sidebar sidebar-open" : "sidebar"}>
      <div className="sidebar-header">
        <div className="brand" aria-label="job-application-autofill">
          <span className="brand-symbol" aria-hidden="true"><BriefcaseBusiness size={19} strokeWidth={2.2} /></span>
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
          <span className="nav-label">Menu</span>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "nav active" : "nav"}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => {
                setTab(id);
                setMenuOpen(false);
              }}
            >
              <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <LocalProfiles controller={controller} />
        <div className="sidebar-bottom">
          <span className="sidebar-privacy-dot" aria-hidden="true" />
          Your workspace is saved on this device
        </div>
      </div>
    </aside>
  );
}
