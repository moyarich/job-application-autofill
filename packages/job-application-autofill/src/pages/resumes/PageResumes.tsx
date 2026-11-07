import { ResumeManager } from "../../components/ResumeManager/ResumeManager";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import type { ApplicationController } from "../../utils/application/useApplication";

export function PageResumes({ controller }: { controller: ApplicationController }) {
  return (
    <>
      <WorkspaceHeader
        title="Resumes"
        description="Your experience, tailored for every opportunity. Manage all your resume versions here."
      />
      <ResumeManager controller={controller} />
    </>
  );
}
