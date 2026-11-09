import { NoResume } from "../../components/NoResume/NoResume";
import { ResumeParser } from "../../components/ResumeParser/ResumeParser";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import { useProfileSelection } from "../../hooks/useProfileSelection";
import { useProfileContacts } from "../../hooks/useProfileContacts";
import { useResumeDraft } from "../../hooks/useResumeDraft";
import { contactKeys } from "../../utils/contacts/contact-context";
import { PageStatus } from "../../components/PageStatus/PageStatus";
import { useResumeImport } from "../../hooks/useResumeImport";
import { createExportResumePdf } from "../../utils/resumes/exportResumePdf";
import { ContactImportReview } from "../../components/ContactImportReview/ContactImportReview";

export function PageResumeImport() {
  const selection = useProfileSelection();
  const contacts = useProfileContacts({
    profileId: selection.activeProfileId,
    enabled: selection.hydrated,
    setMessage: selection.setMessage,
  });
  const draft = useResumeDraft({
    profileId: selection.activeProfileId,
    resumeId: selection.activeResumeId,
    enabled: selection.hydrated && contacts.contactsHydrated,
    contacts: contacts.contacts,
    setMessage: selection.setMessage,
    applicationId: selection.applicationId,
  });
  const ready =
    selection.hydrated && contacts.contactsHydrated &&
    (!selection.activeResumeId || draft.resumeHydrated);
  const flushPending = async () => {
    await draft.flushResume();
    await contacts.flushContacts();
  };
  const record = {
    ...selection,
    ...contacts,
    ...draft,
    contactKeys,
    flushPending,
    hydrated: ready,
    selectedContact: contacts.contacts.find(
      (item) => item.id === draft.contactId,
    ),
    defaultContact: contacts.contacts.find(
      (item) => item.id === contacts.defaultContactId,
    ),
  };
  const importing = useResumeImport(record);
  const controller = {
    ...record,
    ...importing,
    exportResumePdf: createExportResumePdf(record),
  };
  return (
    <PageStatus
      hydrated={ready}
      message={selection.message}
      setMessage={selection.setMessage}
    >
      <>
        <WorkspaceHeader
          title="Import a resume"
        />
        {selection.activeResumeId ? <ResumeParser controller={controller} /> : <NoResume />}
        {selection.activeResumeId && <ContactImportReview controller={controller} />}
      </>
    </PageStatus>
  );
}
