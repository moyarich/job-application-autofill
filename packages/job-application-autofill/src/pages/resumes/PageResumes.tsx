import { FileUp } from "lucide-react";
import { navigateTo } from "../../utils/resumes/navigateTo";
import { routes } from "../../routes";
import { ResumeManager } from "../../components/ResumeManager/ResumeManager";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import { useProfileSelection } from "../../hooks/useProfileSelection";
import { useProfileContacts } from "../../hooks/useProfileContacts";
import { PageStatus } from "../../components/PageStatus/PageStatus";
import { createResumeCommands } from "../../utils/resumes/commands";

export function PageResumes() {
  const selection = useProfileSelection();
  const contacts = useProfileContacts({
    profileId: selection.activeProfileId,
    enabled: selection.hydrated,
    setMessage: selection.setMessage,
  });
  const ready = selection.hydrated && contacts.contactsHydrated;
  const flushPending = async () => {
    await contacts.flushContacts();
  };
  const record = { ...selection, ...contacts, flushPending, hydrated: ready };
  const controller = { ...record, ...createResumeCommands(record) };
  return (
    <PageStatus
      hydrated={ready}
      message={selection.message}
      setMessage={selection.setMessage}
    >
      <>
        <WorkspaceHeader
          title="Resumes"
          actions={
            <button
              className="primary"
              type="button"
              onClick={() =>
                navigateTo(
                  selection.activeProfileId,
                  undefined,
                  routes.resumeImport,
                )
              }
            >
              <FileUp size={16} /> Import resume
            </button>
          }
        />
        <ResumeManager controller={controller} />
      </>
    </PageStatus>
  );
}
