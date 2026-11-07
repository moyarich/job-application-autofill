import { CandidateProfile } from "../../../components/CandidateProfile/CandidateProfile";
import { WorkspaceHeader } from "../../../components/WorkspaceHeader/WorkspaceHeader";
import type { ApplicationController } from "../../../utils/application/useApplication";

export function ResumeEditor({ controller }: { controller: ApplicationController }) {
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
