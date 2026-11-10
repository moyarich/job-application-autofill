import { ContactManager } from "../../components/ContactManager/ContactManager";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import { useProfileSelection } from "../../hooks/useProfileSelection";
import { useProfileContacts } from "../../hooks/useProfileContacts";
import { PageStatus } from "../../components/PageStatus/PageStatus";

export function PageContacts() {
  const selection = useProfileSelection();
  const contacts = useProfileContacts({
    profileId: selection.activeProfileId,
    enabled: selection.hydrated,
    setMessage: selection.setMessage,
  });
  const ready = selection.hydrated && contacts.contactsHydrated;
  const controller = {
    ...selection,
    ...contacts,
    flushPending: contacts.flushContacts,
  };

  return (
    <PageStatus
      hydrated={ready}
      message={selection.message}
      setMessage={selection.setMessage}
    >
      <>
        <WorkspaceHeader title="Contacts" />
        <ContactManager controller={controller} />
      </>
    </PageStatus>
  );
}
