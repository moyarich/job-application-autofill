import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { JobApplication } from "../index";
import { readJobs, saveJob, deleteJob } from "../utils/api/client";

/** Applications have their own list, revision, and save queue. No resume state. */
export function useJobApplications({
  profileId, enabled, applicationId, setMessage,
}: {
  profileId: string;
  enabled: boolean;
  applicationId: string | null;
  setMessage: Dispatch<SetStateAction<string>>;
}) {
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [jobsHydrated, setJobsHydrated] = useState(false);
  const revisionsRef = useRef<Record<string, number>>({});
  const savedRef = useRef("");
  const queue = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocked = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setJobsHydrated(false);
    readJobs(profileId).then((result) => {
      if (cancelled) return;
      setJobs(result.jobs);
      revisionsRef.current = result.revisions;
      savedRef.current = JSON.stringify(result.jobs);
      blocked.current = false;
      setJobsHydrated(true);
    }).catch((error) => {
      if (!cancelled) setMessage("Could not load applications: " + String(error));
    });
    return () => { cancelled = true; };
  }, [profileId, enabled]);

  async function persistJobs() {
    if (blocked.current) throw new Error("Application updates could not be saved.");
    const signature = JSON.stringify(jobs);
    if (signature === savedRef.current) return;
    const previous = JSON.parse(savedRef.current || "[]") as JobApplication[];
    const before = new Map(previous.map((job) => [job.id, job]));
    const after = new Map(jobs.map((job) => [job.id, job]));
    for (const job of jobs) {
      if (JSON.stringify(before.get(job.id)) === JSON.stringify(job)) continue;
      const result = await saveJob(profileId, { revision: revisionsRef.current[job.id] ?? 0, job });
      revisionsRef.current[job.id] = result.revision;
      before.set(job.id, job);
      savedRef.current = JSON.stringify([...before.values()]);
    }
    for (const previousJob of previous) {
      if (after.has(previousJob.id)) continue;
      await deleteJob(profileId, previousJob.id, revisionsRef.current[previousJob.id]);
      delete revisionsRef.current[previousJob.id];
      before.delete(previousJob.id);
      savedRef.current = JSON.stringify([...before.values()]);
    }
    savedRef.current = signature;
  }

  useEffect(() => {
    if (!jobsHydrated || applicationId || blocked.current) return;
    if (JSON.stringify(jobs) === savedRef.current) return;
    const current = setTimeout(() => {
      queue.current = queue.current.then(persistJobs).catch((error) => {
        blocked.current = true;
        setMessage("Could not save applications: " + String(error));
      });
    }, 350);
    timer.current = current;
    return () => clearTimeout(current);
  }, [jobs, jobsHydrated, applicationId, profileId]);

  async function flushJobs() {
    if (timer.current) clearTimeout(timer.current);
    await queue.current;
    if (blocked.current) throw new Error("Application updates could not be saved.");
    try { await persistJobs(); }
    catch (error) { blocked.current = true; throw error; }
  }

  return { jobs, setJobs, jobsHydrated, flushJobs };
}
