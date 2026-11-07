import { ContactManager } from "../../components/ContactManager/ContactManager";
import { LocalProfiles } from "../../components/LocalProfiles/LocalProfiles";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import type { useWorkspace } from "../../hooks/useWorkspace";

export function PageProfile({ workspace }: { workspace: ReturnType<typeof useWorkspace> }) {
  const controller = workspace;
  return (
    <>
      <WorkspaceHeader
        title="Profile"
        description="Manage your saved contact details and the profile you are working with."
      />
      <section className="panel">
        <div className="panel-title">
          <h2>Your profile</h2>
          <p>Choose a profile and manage its saved contact details.</p>
        </div>
        <LocalProfiles controller={controller} />
      </section>
      <ContactManager controller={controller} />
    </>
  );
}
