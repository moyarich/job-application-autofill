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
          description="Choose, create, rename, and manage the profiles in your workspace."
        />
        <section className="panel">
          <div className="panel-title">
            <h2>Your profiles</h2>
            <p>Manage profiles independently from saved contact details.</p>
          </div>
          <LocalProfiles controller={controller} />
        </section>
      </>
    </PageStatus>
  );
}
