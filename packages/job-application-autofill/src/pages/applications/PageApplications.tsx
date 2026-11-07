import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ListChecks,
  MessageCircle,
} from "lucide-react";
import { Opportunities } from "../../components/Opportunities/Opportunities";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import { useProfileSelection } from "../../hooks/useProfileSelection";
import { useJobApplications } from "../../hooks/useJobApplications";
import { PageStatus } from "../../components/PageStatus/PageStatus";
import { useJobTracker } from "../../hooks/useJobTracker";
import { openApplication } from "../../utils/application/openApplication";

export function PageApplications() {
  const selection = useProfileSelection();
  const applications = useJobApplications({
    profileId: selection.activeProfileId,
    enabled: selection.hydrated,
    applicationId: selection.applicationId,
    setMessage: selection.setMessage,
  });
  const tracker = useJobTracker({ ...selection, ...applications });
  const { jobs } = applications;
  const prepareJob = (job: (typeof jobs)[number]) =>
    openApplication(job, selection.activeProfileId, selection.activeResumeId);
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
          description="Organize your job search and keep every application on track."
          actions={
            <button
              type="button"
              className="primary"
              onClick={() =>
                document.getElementById("add-application")?.scrollIntoView({
                  behavior: "smooth",
                })
              }
            >
              Add application <ArrowRight size={16} />
            </button>
          }
        />
        <section className="stats" aria-label="Application overview">
          <div className="stat">
            <span>
              <ListChecks size={15} aria-hidden="true" /> Total applications
            </span>
            <strong>{jobs.length}</strong>
          </div>
          <div className="stat">
            <span>
              <Clock3 size={15} aria-hidden="true" /> In progress
            </span>
            <strong>
              {
                jobs.filter(
                  (job) =>
                    job.status === "in_progress" ||
                    job.status === "ready_for_review",
                ).length
              }
            </strong>
          </div>
          <div className="stat">
            <span>
              <CheckCircle2 size={15} aria-hidden="true" /> Submitted
            </span>
            <strong>
              {jobs.filter((job) => job.status === "submitted").length}
            </strong>
          </div>
          <div className="stat">
            <span>
              <MessageCircle size={15} aria-hidden="true" /> Interviews
            </span>
            <strong>
              {jobs.filter((job) => job.status === "interview").length}
            </strong>
          </div>
        </section>
        <Opportunities controller={controller} />
      </>
    </PageStatus>
  );
}
