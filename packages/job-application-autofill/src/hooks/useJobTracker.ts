import { useState } from "react";
import type React from "react";
import { createApplication, type ApplicationStatus } from "../index";
import { changeJobStatus } from "../utils/application/changeJobStatus";
import type { JobTrackerData } from "../utils/application/job-tracker-data";
export function useJobTracker(workspace: JobTrackerData) {
  const { jobs, setJobs, setMessage } = workspace;
  const [newJob, setNewJob] = useState({ company: "", role: "", url: "" });
  const [search, setSearch] = useState("");
  const [notesJobId, setNotesJobId] = useState<string | null>(null);
  const filtered = jobs.filter((job) =>
    (job.company + " " + job.role).toLowerCase().includes(search.toLowerCase()),
  );

  function addJob(event: React.FormEvent) {
    event.preventDefault();
    try {
      const job = createApplication(newJob.company, newJob.role, newJob.url);
      if (
        jobs.some(
          (item) =>
            item.id === job.id ||
            (item.company === job.company &&
              item.role === job.role &&
              item.url === job.url),
        )
      ) {
        setMessage("This opportunity is already in your tracker.");
        return;
      }
      setJobs((items) => [job, ...items]);
      setNewJob({ company: "", role: "", url: "" });
      setMessage(
        "Job added. Select Apply on its row to start browser automation.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add job");
    }
  }
  function changeJob(id: string, status: ApplicationStatus) {
    changeJobStatus(id, status, workspace);
  }

  return { newJob, setNewJob, search, setSearch, notesJobId, setNotesJobId,
    filtered, addJob, changeJob };
}
