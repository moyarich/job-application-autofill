import { useEffect, useRef, useState } from "react";
import type React from "react";

import { changeJobStatus } from "../utils/application/changeJobStatus";
import { requestApi } from "../api/client";
import type { JobTrackerData } from "../types/job-tracker-data";
import { JobPostingDetails, ApplicationStatus } from "../types/job-application";
import { createApplication } from "../utils/application/createApplication";

export function useJobTracker(workspace: JobTrackerData) {
  const { jobs, setJobs, setMessage, activeProfileId } = workspace;
  const [newJob, setNewJob] = useState({ company: "", role: "", url: "" });
  const [jobDetails, setJobDetails] = useState<JobPostingDetails | null>(null);
  const [search, setSearch] = useState("");
  const [metadataBusy, setMetadataBusy] = useState(false);
  const [metadataError, setMetadataError] = useState("");
  const autoFilled = useRef({ company: "", role: "" });
  useEffect(() => {
    const url = newJob.url.trim();
    setJobDetails(null);
    if (!/^https:\/\/[^\s/]+\.[^\s/]+/i.test(url)) {
      setMetadataError("");
      setMetadataBusy(false);
      return;
    }
    setMetadataBusy(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      setMetadataBusy(true);
      setMetadataError("");
      try {
        const details = await requestApi<{
          company: string;
          role: string;
          details?: JobPostingDetails;
        }>("/api/jobs/metadata", { jobUrl: url }, activeProfileId);
        if (cancelled) return;
        setJobDetails(details.details ?? null);
        setNewJob((current) => {
          if (current.url.trim() !== url) return current;
          const next = {
            ...current,
            company:
              !current.company.trim() ||
              current.company === autoFilled.current.company
                ? details.company || current.company
                : current.company,
            role:
              !current.role.trim() || current.role === autoFilled.current.role
                ? details.role || current.role
                : current.role,
          };
          autoFilled.current = {
            company:
              next.company === details.company
                ? details.company
                : autoFilled.current.company,
            role:
              next.role === details.role
                ? details.role
                : autoFilled.current.role,
          };
          return next;
        });
        if (!details.company || !details.role)
          setMetadataError(
            "Some details could not be detected. Check the company and role.",
          );
      } catch {
        if (!cancelled)
          setMetadataError(
            "This site did not provide job details. Enter the company and role manually.",
          );
      } finally {
        if (!cancelled) setMetadataBusy(false);
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [newJob.url, activeProfileId]);
  const [notesJobId, setNotesJobId] = useState<string | null>(null);

  function addJob(event: React.FormEvent) {
    event.preventDefault();
    try {
      const job = {
        ...createApplication(
          newJob.company,
          newJob.role,
          jobDetails?.postingUrl || newJob.url,
        ),
        accountAction: "signup" as const,
        ...(jobDetails ? { details: jobDetails } : {}),
      };
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
      autoFilled.current = { company: "", role: "" };
      setMetadataError("");
      setJobDetails(null);
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

  return {
    jobDetails,
    newJob,
    setNewJob,
    metadataBusy,
    metadataError,
    search,
    setSearch,
    notesJobId,
    setNotesJobId,
    addJob,
    changeJob,
  };
}
