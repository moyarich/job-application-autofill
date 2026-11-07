import type { Dispatch, SetStateAction } from "react";
import type { JobApplication } from "../../index";

export type JobTrackerData = {
  jobs: JobApplication[];
  setJobs: Dispatch<SetStateAction<JobApplication[]>>;
  applicationId: string | null;
  activeProfileId: string;
  activeResumeId: string | null;
  setMessage: Dispatch<SetStateAction<string>>;
};
