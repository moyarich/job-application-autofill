import { useProfileSelection } from "../../hooks/useProfileSelection";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import { ApplicationPreferences } from "../../components/ApplicationPreferences/ApplicationPreferences";

export function PageApplicationPreferences() {
  const selection = useProfileSelection();
  return (
    <>
      <WorkspaceHeader title="Application preferences" />
      {selection.hydrated && (
        <ApplicationPreferences
          key={selection.activeProfileId}
          profileId={selection.activeProfileId}
        />
      )}
    </>
  );
}
