import { ResumeManager } from "../../components/ResumeManager/ResumeManager";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import { useStoredRecord } from "../../hooks/useStoredRecord";
import { PageStatus } from "../../components/App/PageStatus";
import { createResumeCommands } from "../../utils/resumes/commands";

export function PageResumes() {
  const record = useStoredRecord();
  const controller = { ...record, ...createResumeCommands(record) };
  return (
    <PageStatus {...record}>
      <>
      <WorkspaceHeader
        title="Resumes"
        description="Your experience, tailored for every opportunity. Manage all your resume versions here."
      />
      <ResumeManager controller={controller} />
      </>
    </PageStatus>
  );
}
