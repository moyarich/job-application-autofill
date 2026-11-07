import { ResumeView } from "../../components/ResumeView/ResumeView";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import { useStoredRecord } from "../../hooks/useStoredRecord";
import { PageStatus } from "../../components/App/PageStatus";
import { createResumeCommands } from "../../utils/resumes/commands";

export function PageResumeView() {
  const record = useStoredRecord();
  const controller = { ...record, ...createResumeCommands(record) };
  return (
    <PageStatus {...record}>
      <>
      <WorkspaceHeader
        title="View resume"
        description="Review your resume and export it in the format you need."
      />
      <ResumeView controller={controller} />
      </>
    </PageStatus>
  );
}
