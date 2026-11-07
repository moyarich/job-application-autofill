import { ResumeParser } from "../../components/ResumeParser/ResumeParser";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import type { ApplicationController } from "../../utils/application/useApplication";

export function ResumeImportPage({ controller }: { controller: ApplicationController }) {
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
