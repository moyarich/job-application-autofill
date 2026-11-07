import { ResumeView } from "../../components/ResumeView/ResumeView";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import type { useApplication } from "../../hooks/useApplication";

export function PageResumeView({ controller }: { controller: ReturnType<typeof useApplication> }) {
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
