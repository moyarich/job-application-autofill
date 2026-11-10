import type { Dispatch, SetStateAction } from "react";

import { requestApi } from "../../api/client";
import { ApplicationStatus, JobApplication } from "../../types/job-application";

/** Change a job status without depending on a tracker hook. */
export function changeJobStatus(
  id: string,
  status: ApplicationStatus,
  context: {
    applicationId: string | null;
    activeProfileId: string;
    activeResumeId: string | null;
    setJobs: Dispatch<SetStateAction<JobApplication[]>>;
    setMessage: Dispatch<SetStateAction<string>>;
  },
) {
  const {
    applicationId,
    activeProfileId,
    activeResumeId,
    setJobs,
    setMessage,
  } = context;
  if (applicationId) {
    void requestApi(
      "/api/jobs/" + id + "/status",
      { status },
      activeProfileId,
      activeResumeId ?? undefined,
    ).catch((error) => setMessage(String(error)));
  }
  setJobs((items) =>
    items.map((item) => (item.id === id ? { ...item, status } : item)),
  );
}
