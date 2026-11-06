import type { CandidateProfile, JobApplication } from "../../index";
export async function requestApi<T>(url: string, data: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Moya-Client": "dashboard",
    },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Local API request failed");
  return result as T;
}
export type StoredState = {
  revision: number;
  profile: CandidateProfile | null;
  jobs: JobApplication[];
};
export async function readState(): Promise<StoredState> {
  const response = await fetch("/api/state", {
    headers: { "X-Moya-Client": "dashboard" },
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Could not load SQLite data.");
  return result as StoredState;
}
export async function saveState(payload: {
  revision: number;
  profile: CandidateProfile;
  jobs: JobApplication[];
}): Promise<{ revision: number }> {
  const response = await fetch("/api/state", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Moya-Client": "dashboard",
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Could not save SQLite data.");
  return result as { revision: number };
}
