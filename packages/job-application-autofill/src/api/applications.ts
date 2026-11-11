import { requestApi } from "./client";
import type { ApplySession } from "../types/types";

type ActiveApplicationResponse = { session: ApplySession | null };

/** Read the active browser session for one saved application. */
export async function readActiveApplication(
  applicationId: string,
  profileId: string,
  signal?: AbortSignal,
): Promise<ActiveApplicationResponse> {
  const response = await fetch(
    "/api/apply/active?jobId=" + encodeURIComponent(applicationId),
    {
      headers: {
        "X-Moya-Client": "dashboard",
        "X-Profile-Id": profileId,
      },
      cache: "no-store",
      signal,
    },
  );
  if (!response.ok)
    throw new Error("Application session is unavailable. Reload to retry.");
  return response.json() as Promise<ActiveApplicationResponse>;
}

export function prepareApplicationSession(
  payload: { jobUrl: string; jobId: string; profile: unknown; resume: unknown },
  profileId: string,
  resumeId?: string,
) {
  return requestApi<ApplySession>(
    "/api/apply/prepare",
    payload,
    profileId,
    resumeId,
  );
}

export function prepareEmployerAccount(
  sessionId: string,
  password: string | undefined,
  profileId: string,
  resumeId?: string,
) {
  return requestApi<ApplySession>(
    "/api/apply/" + encodeURIComponent(sessionId) + "/account-signup",
    password ? { password } : {},
    profileId,
    resumeId,
  );
}

export function continueApplicationSession(
  sessionId: string,
  profileId: string,
  resumeId?: string,
) {
  return requestApi<ApplySession>(
    "/api/apply/" + encodeURIComponent(sessionId) + "/continue",
    {},
    profileId,
    resumeId,
  );
}

export function finalizeApplicationSession(
  sessionId: string,
  submit: boolean,
  reviewed: boolean,
  profileId: string,
  resumeId?: string,
) {
  return requestApi<ApplySession | { closed: boolean }>(
    "/api/apply/" +
      encodeURIComponent(sessionId) +
      "/" +
      (submit ? "submit" : "close"),
    submit ? { confirm: true, reviewed } : {},
    profileId,
    resumeId,
  );
}
