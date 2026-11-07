import { ContactManager } from "../../components/ContactManager/ContactManager";
import { LocalProfiles } from "../../components/LocalProfiles/LocalProfiles";
import { ResumeManager } from "../../components/ResumeManager/ResumeManager";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import { useProfileSelection } from "../../hooks/useProfileSelection";
import { useProfileContacts } from "../../hooks/useProfileContacts";
import { PageStatus } from "../../components/App/PageStatus";
import { createResumeCommands } from "../../utils/resumes/commands";

export function PageWorkspace() {
  const selection = useProfileSelection();
  const contacts = useProfileContacts({
    profileId: selection.activeProfileId, enabled: selection.hydrated,
    setMessage: selection.setMessage,
  });
  const ready = selection.hydrated && contacts.contactsHydrated;
  const flushPending = async () => { await contacts.flushContacts(); };
  const record = { ...selection, ...contacts, flushPending, hydrated: ready };
  const controller = { ...record, ...createResumeCommands(record) };
  return (
    <PageStatus hydrated={ready} message={selection.message} setMessage={selection.setMessage}>
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
    </PageStatus>
  );
}
