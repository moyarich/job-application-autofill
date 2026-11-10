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

const applicationPath = (session: string) =>
  "/api/apply/" + encodeURIComponent(session);

export function readViewerMenu(session: string, profile: string) {
  return viewerRequest<{ items?: MenuItem[]; session?: ViewerSession }>(
    applicationPath(session) + "/menu",
    profile,
  );
}

export function readViewerSession(session: string, profile: string) {
  return viewerRequest<ViewerSession>(applicationPath(session), profile);
}

export function runViewerAction(
  session: string,
  profile: string,
  action: "continue" | "pause" | "close" | "menu",
  itemId?: string,
) {
  return viewerRequest(
    applicationPath(session) + "/" + action,
    profile,
    action === "menu" ? { itemId } : {},
  );
}

export function focusViewerBrowser(
  session: string,
  profile: string,
  signal?: AbortSignal,
) {
  return viewerRequest(applicationPath(session) + "/focus", profile, {}, signal);
}

export function pasteViewerText(
  session: string,
  profile: string,
  text: string,
  signal?: AbortSignal,
) {
  return viewerRequest(
    applicationPath(session) + "/paste",
    profile,
    { text },
    signal,
  );
}

export function readViewerConfig(profile: string, signal?: AbortSignal) {
  return viewerRequest<{ password: string }>(
    "/api/viewer/config",
    profile,
    undefined,
    signal,
  );
}
