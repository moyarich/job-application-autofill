import { ResumeParser } from "../../components/ResumeParser/ResumeParser";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import type { useWorkspace } from "../../hooks/useWorkspace";
import { useResumeImport } from "../../hooks/useResumeImport";
import { ContactImportReview } from "../../components/ContactImportReview/ContactImportReview";

export function PageResumeImport({ workspace }: { workspace: ReturnType<typeof useWorkspace> }) {
  const importing = useResumeImport(workspace);
  const controller = { ...workspace, ...importing };
  return (
    <>
      <WorkspaceHeader
        title="Import a resume"
        description="Bring in a PDF, Word document, or resume JSON to get started."
      />
      <ResumeParser controller={controller} />
      <ContactImportReview controller={controller} />
    </>
  );
}
