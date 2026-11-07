import { ResumeView } from "../../components/ResumeView/ResumeView";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import { useProfileSelection } from "../../hooks/useProfileSelection";
import { useProfileContacts } from "../../hooks/useProfileContacts";
import { useResumeDraft } from "../../hooks/useResumeDraft";
import { PageStatus } from "../../components/App/PageStatus";
import { createResumeCommands } from "../../utils/resumes/commands";

export function PageResumeView() {
  const selection = useProfileSelection();
  const contacts = useProfileContacts({
    profileId: selection.activeProfileId, enabled: selection.hydrated,
    setMessage: selection.setMessage,
  });
  const draft = useResumeDraft({
    profileId: selection.activeProfileId, resumeId: selection.activeResumeId,
    enabled: selection.hydrated && contacts.contactsHydrated,
    contacts: contacts.contacts, setMessage: selection.setMessage,
    applicationId: selection.applicationId,
  });
  const ready = selection.hydrated && contacts.contactsHydrated && draft.resumeHydrated;
  const flushPending = async () => {
    await draft.flushResume();
    await contacts.flushContacts();
  };
  const record = { ...selection, ...contacts, ...draft, flushPending, hydrated: ready };
  const controller = { ...record, ...createResumeCommands(record) };
  return (
    <PageStatus hydrated={ready} message={selection.message} setMessage={selection.setMessage}>
      <>
      <WorkspaceHeader
        title="View resume"
        description="Review your resume and export it in the format you need."
      />
      <ResumeView controller={controller} />
      </>
    </PageStatus>
  );
}
