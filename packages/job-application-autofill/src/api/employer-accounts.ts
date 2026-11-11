import type { ApplySession } from "../types/types";
import { requestApi } from "./client";

export function updateEmployerAccountStatus(
  jobId: string,
  status: "ready" | "setup_required",
  profileId: string,
  resumeId?: string,
) {
  return requestApi<NonNullable<ApplySession["employerAccount"]>>(
    "/api/employer-accounts/status",
    { jobId, status },
    profileId,
    resumeId,
  );
}
