import { CandidateProfile } from "../../components/CandidateProfile/CandidateProfile";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import type { useApplication } from "../../hooks/useApplication";

export function PageResumeEditor({ controller }: { controller: ReturnType<typeof useApplication> }) {
  return (
    <>
      <WorkspaceHeader
        title="Resume editor"
        description="Manage your contact details, experience, and resume versions."
      />
      <CandidateProfile controller={controller} />
    </>
  );
}
