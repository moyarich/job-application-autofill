import { ResumeManager } from "../../components/ResumeManager/ResumeManager";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import type { useApplication } from "../../hooks/useApplication";

export function PageResumes({ controller }: { controller: ReturnType<typeof useApplication> }) {
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
