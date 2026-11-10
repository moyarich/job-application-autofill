export type ViewerSession = {
  id?: string;
  state: string;
  paused?: boolean;
  running?: boolean;
  currentAction?: string | null;
};
export type MenuItem = {
  id: string;
  label: string;
  available: boolean;
  status?: "processed" | "filled" | "needs_review" | "ready";
};
export const viewerHeaders = (profile: string) => ({
  "X-Moya-Client": "dashboard",
  "X-Profile-Id": profile,
});
export async function viewerRequest<T>(
  path: string,
  profile: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...viewerHeaders(profile),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to connect.");
  return data as T;
}
export function menuError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return /expired|closed|ended/i.test(text)
    ? "Session ended. Reopen the application."
    : /fetch|network|connect/i.test(text)
      ? "Can’t connect. Try again."
      : "Couldn’t complete that action. Try again.";
}
