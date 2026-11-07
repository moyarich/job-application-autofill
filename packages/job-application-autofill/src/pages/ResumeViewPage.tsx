import { ResumeView } from "../components/ResumeView/ResumeView";
import { WorkspaceHeader } from "../components/WorkspaceHeader/WorkspaceHeader";
import type { ApplicationController } from "../utils/application/useApplication";

export function ResumeViewPage({ controller }: { controller: ApplicationController }) {
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
