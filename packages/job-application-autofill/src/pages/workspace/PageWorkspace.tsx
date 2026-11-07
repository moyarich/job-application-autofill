import { ContactManager } from "../../components/ContactManager/ContactManager";
import { LocalProfiles } from "../../components/LocalProfiles/LocalProfiles";
import { ResumeManager } from "../../components/ResumeManager/ResumeManager";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import type { useWorkspace } from "../../hooks/useWorkspace";

export function PageWorkspace({ workspace }: { workspace: ReturnType<typeof useWorkspace> }) {
  const controller = workspace;
  return (
    <>
      <WorkspaceHeader
        title="Profiles & resumes"
        description="Manage profiles and the resumes associated with each profile."
      />
      <section className="panel workspace-management">
        <div className="panel-title">
          <h2>Manage profiles and resumes</h2>
          <p>Switch between profiles, create resume versions, and manage saved records.</p>
        </div>
        <LocalProfiles controller={controller} />
      </section>
      <ResumeManager controller={controller} />
      <ContactManager controller={controller} />
    </>
  );
}
