import { CandidateProfile } from "../../components/CandidateProfile/CandidateProfile";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import type { useWorkspace } from "../../hooks/useWorkspace";
import { useResumeImport } from "../../hooks/useResumeImport";
import { ContactImportReview } from "../../components/ContactImportReview/ContactImportReview";

export function PageResumeEditor({ workspace }: { workspace: ReturnType<typeof useWorkspace> }) {
  const importing = useResumeImport(workspace);
  const controller = { ...workspace, ...importing };
  return (
    <>
      <WorkspaceHeader
        title="Resume editor"
        description="Manage your contact details, experience, and resume versions."
      />
      <CandidateProfile controller={controller} />
      <ContactImportReview controller={controller} />
    </>
  );
}
