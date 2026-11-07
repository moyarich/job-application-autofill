import { ResumeView } from "../../components/ResumeView/ResumeView";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import type { useWorkspace } from "../../hooks/useWorkspace";

export function PageResumeView({ workspace }: { workspace: ReturnType<typeof useWorkspace> }) {
  const controller = workspace;
  return (
    <>
      <WorkspaceHeader
        title="View resume"
        description="Review your resume and export it in the format you need."
      />
      <ResumeView controller={controller} />
    </>
  );
}
