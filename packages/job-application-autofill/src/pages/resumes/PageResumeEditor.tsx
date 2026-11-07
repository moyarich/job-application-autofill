import { CandidateProfile } from "../../components/CandidateProfile/CandidateProfile";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import { useStoredRecord } from "../../hooks/useStoredRecord";
import { PageStatus } from "../../components/App/PageStatus";
import { useResumeImport } from "../../hooks/useResumeImport";
import { createResumeCommands } from "../../utils/resumes/commands";
import { createContactCommands } from "../../utils/contacts/commands";
import { createExportResumePdf } from "../../utils/resumes/exportResumePdf";
import { ContactImportReview } from "../../components/ContactImportReview/ContactImportReview";

export function PageResumeEditor() {
  const record = useStoredRecord();
  const importing = useResumeImport(record);
  const controller = {
    ...record, ...importing,
    ...createResumeCommands(record),
    ...createContactCommands(record),
    exportResumePdf: createExportResumePdf(record),
  };
  return (
    <PageStatus {...record}>
      <>
      <WorkspaceHeader
        title="Resume editor"
        description="Manage your contact details, experience, and resume versions."
      />
      <CandidateProfile controller={controller} />
      <ContactImportReview controller={controller} />
      </>
    </PageStatus>
  );
}
