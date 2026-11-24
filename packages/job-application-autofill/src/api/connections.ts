export interface ConnectorManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  authentication: "none" | "token" | "oauth2";
}

export interface Connection {
  id: string;
  connectorId: string;
  name: string;
  allowWrites: boolean;
  createdAt: string;
}

export interface ConnectionTool {
  name: string;
  description: string;
  access: "read" | "write";
}

export async function connectionRequest<T>(
  profileId: string,
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api/" + path, {
    method,
    headers: {
      "X-Moya-Client": "dashboard",
      "X-Profile-Id": profileId,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error("Connection request failed (HTTP " + response.status + ").");
  }
  return (await response.json()) as T;
}
