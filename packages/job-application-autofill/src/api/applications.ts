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
