import { ResumeParser } from "../../components/ResumeParser/ResumeParser";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import type { useApplication } from "../../hooks/useApplication";

export function PageResumeImport({ controller }: { controller: ReturnType<typeof useApplication> }) {
  return (
    <>
      <WorkspaceHeader
        title="Import a resume"
        description="Bring in a PDF, Word document, or resume JSON to get started."
      />
      <ResumeParser controller={controller} />
    </>
  );
}
