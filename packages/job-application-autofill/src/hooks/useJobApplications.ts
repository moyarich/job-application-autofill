import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { JobApplication } from "../index";
import { readJobs, saveJobs } from "../utils/api/client";

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
  const revisionRef = useRef(0);
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
      revisionRef.current = result.revision;
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
    const result = await saveJobs(profileId, { revision: revisionRef.current, jobs });
    revisionRef.current = result.revision;
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
