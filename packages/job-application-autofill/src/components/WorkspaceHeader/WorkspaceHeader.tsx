import type { ReactNode } from "react";
import "./WorkspaceHeader.css";

type WorkspaceHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

/** Presentation only: each page decides which actions are relevant. */
export function WorkspaceHeader({
  title,
  description,
  actions,
}: WorkspaceHeaderProps) {
  return (
    <header className="workspace-header">
      <div>
        <div className="eyebrow">Workspace / {title}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}
