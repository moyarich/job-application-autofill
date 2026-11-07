import { ArrowRight, CheckCircle2, Clock3, ListChecks, MessageCircle } from "lucide-react";
import { Opportunities } from "../../components/Opportunities/Opportunities";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import type { useWorkspace } from "../../hooks/useWorkspace";
import { useJobTracker } from "../../hooks/useJobTracker";
import { openApplication } from "../../utils/application/openApplication";

export function PageApplications({ workspace }: { workspace: ReturnType<typeof useWorkspace> }) {
  const tracker = useJobTracker(workspace);
  const { jobs } = workspace;
  const prepareJob = (job: (typeof jobs)[number]) => openApplication(job, workspace.activeProfileId, workspace.activeResumeId);
  const controller = { ...workspace, ...tracker, prepareJob };
  return (
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
        <div className="stat"><span><ListChecks size={15} aria-hidden="true" /> Total applications</span><strong>{jobs.length}</strong></div>
        <div className="stat"><span><Clock3 size={15} aria-hidden="true" /> In progress</span>
          <strong>{jobs.filter((job) => job.status === "in_progress" || job.status === "ready_for_review").length}</strong></div>
        <div className="stat"><span><CheckCircle2 size={15} aria-hidden="true" /> Submitted</span>
          <strong>{jobs.filter((job) => job.status === "submitted").length}</strong></div>
        <div className="stat"><span><MessageCircle size={15} aria-hidden="true" /> Interviews</span>
          <strong>{jobs.filter((job) => job.status === "interview").length}</strong></div>
      </section>
      <Opportunities controller={controller} />
    </>
  );
}
