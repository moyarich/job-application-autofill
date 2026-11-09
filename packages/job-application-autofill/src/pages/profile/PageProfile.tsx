import { LocalProfiles } from "../../components/LocalProfiles/LocalProfiles";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import { useProfileSelection } from "../../hooks/useProfileSelection";
import { PageStatus } from "../../components/PageStatus/PageStatus";
import { createResumeCommands } from "../../utils/resumes/commands";

export function PageProfile() {
  const selection = useProfileSelection();
  const record = { ...selection, flushPending: async () => {} };
  const controller = { ...record, ...createResumeCommands(record) };

  return (
    <PageStatus
      hydrated={selection.hydrated}
      message={selection.message}
      setMessage={selection.setMessage}
    >
      <>
        <WorkspaceHeader
          title="Profiles"
        />
        <section className="panel">
          <div className="panel-title">
            <h2>Your profiles</h2>
          </div>
          <LocalProfiles controller={controller} />
        </section>
      </>
    </PageStatus>
  );
}
