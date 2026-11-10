import { Plus } from "lucide-react";
import { useState } from "react";
import { Opportunities } from "../../components/Opportunities/Opportunities";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import { useProfileSelection } from "../../hooks/useProfileSelection";
import { useJobApplications } from "../../hooks/useJobApplications";
import { PageStatus } from "../../components/PageStatus/PageStatus";
import { useJobTracker } from "../../hooks/useJobTracker";
import { openApplication } from "../../utils/application/openApplication";

export function PageApplications() {
  const [showAddForm, setShowAddForm] = useState(false);
  const selection = useProfileSelection();
  const applications = useJobApplications({
    profileId: selection.activeProfileId,
    enabled: selection.hydrated,
    applicationId: selection.applicationId,
    setMessage: selection.setMessage,
  });
  const tracker = useJobTracker({ ...selection, ...applications });
  const prepareJob = async (job: (typeof applications.jobs)[number]) => {
    if (!job.resumeId) {
      selection.setMessage("Choose a resume for this application before applying.");
      return;
    }
    const target = window.open("about:blank", "application-" + job.id);
    try {
      await applications.flushJobs();
      openApplication(job, selection.activeProfileId, job.resumeId, target);
    } catch (error) {
      target?.close();
      selection.setMessage("Could not save selected resume: " + String(error));
    }
  };
  const controller = { ...selection, ...applications, ...tracker, prepareJob };
  const ready = selection.hydrated && applications.jobsHydrated;
  return (
    <PageStatus
      hydrated={ready}
      message={selection.message}
      setMessage={selection.setMessage}
    >
      <>
        <WorkspaceHeader
          title="Applications"
          actions={
            <button
              type="button"
              className="primary"
              onClick={() => setShowAddForm((visible) => !visible)}
            >
              <Plus size={16} /> Add application
            </button>
          }
        />
        <Opportunities controller={controller} showAddForm={showAddForm} onCloseAddForm={() => setShowAddForm(false)} />
      </>
    </PageStatus>
  );
}
