import { ResumeParser } from "../../components/ResumeParser/ResumeParser";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import { useStoredRecord } from "../../hooks/useStoredRecord";
import { PageStatus } from "../../components/App/PageStatus";
import { useResumeImport } from "../../hooks/useResumeImport";
import { createExportResumePdf } from "../../utils/resumes/exportResumePdf";
import { ContactImportReview } from "../../components/ContactImportReview/ContactImportReview";

export function PageResumeImport() {
  const record = useStoredRecord();
  const importing = useResumeImport(record);
  const controller = {
    ...record, ...importing, exportResumePdf: createExportResumePdf(record),
  };
  return (
    <PageStatus {...record}>
      <>
      <WorkspaceHeader
        title="Import a resume"
        description="Bring in a PDF, Word document, or resume JSON to get started."
      />
      <ResumeParser controller={controller} />
      <ContactImportReview controller={controller} />
      </>
    </PageStatus>
  );
}
