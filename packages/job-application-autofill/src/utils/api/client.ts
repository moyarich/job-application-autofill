import type { CandidateProfile, JobApplication } from "../../index";

export const DEFAULT_PROFILE_ID = "00000000-0000-4000-8000-000000000001";
export const ACTIVE_PROFILE_STORAGE_KEY = "job-application-autofill:active-profile";
export type LocalProfile = { id: string; name: string; createdAt: string };
export type ResumeVersion = { id: string; name: string; createdAt: string };

const profileHeaders = (profileId: string, resumeId?: string) => ({
  "X-Moya-Client": "dashboard",
  "X-Profile-Id": profileId,
  ...(resumeId ? { "X-Resume-Id": resumeId } : {}),
});
async function decodeResponse<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || fallback);
  return result as T;
}
export async function requestApi<T>(url: string, data: unknown, profileId = DEFAULT_PROFILE_ID, resumeId?: string): Promise<T> {
  return decodeResponse<T>(
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...profileHeaders(profileId, resumeId) },
      body: JSON.stringify(data),
    }),
    "Local API request failed",
  );
}
export type StoredState = {
  resumeId: string;
  resumes: ResumeVersion[];
  revision: number;
  profile: CandidateProfile | null;
  contact: CandidateProfile["contact"] | null;
  contactOverrides: Partial<CandidateProfile["contact"]>;
  jobs: JobApplication[];
};
export async function readProfiles(): Promise<{ profiles: LocalProfile[]; defaultProfileId: string }> {
  return decodeResponse(await fetch("/api/profiles", { headers: profileHeaders(DEFAULT_PROFILE_ID), cache: "no-store" }), "Could not list local profiles.");
}
export async function createLocalProfile(name: string): Promise<LocalProfile> {
  return requestApi("/api/profiles", { name });
}
export async function renameLocalProfile(profileId: string, name: string): Promise<LocalProfile> {
  return decodeResponse(await fetch("/api/profiles/" + encodeURIComponent(profileId), {
    method: "PATCH", headers: { "Content-Type": "application/json", ...profileHeaders(profileId) },
    body: JSON.stringify({ name }),
  }), "Could not rename profile.");
}
export async function deleteLocalProfile(profileId: string): Promise<void> {
  await decodeResponse(await fetch("/api/profiles/" + encodeURIComponent(profileId), {
    method: "DELETE", headers: profileHeaders(profileId),
  }), "Could not delete profile.");
}
export async function readState(profileId: string, resumeId?: string): Promise<StoredState> {
  return decodeResponse<StoredState>(
    await fetch("/api/state", { headers: profileHeaders(profileId, resumeId), cache: "no-store" }),
    "Could not load SQLite data.",
  );
}
export async function saveState(payload: {
  revision: number;
  profile: CandidateProfile;
  contact: CandidateProfile["contact"];
  contactOverrides: Partial<CandidateProfile["contact"]>;
  jobs: JobApplication[];
}, profileId: string, resumeId: string): Promise<{ revision: number }> {
  return decodeResponse(
    await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...profileHeaders(profileId, resumeId) },
      body: JSON.stringify(payload),
    }),
    "Could not save SQLite data.",
  );
}

export async function createResumeVersion(profileId: string, name: string, copyId?: string): Promise<ResumeVersion> {
  return requestApi<ResumeVersion>("/api/resumes", { name, copyId }, profileId);
}
export async function renameResumeVersion(profileId: string, resumeId: string, name: string): Promise<ResumeVersion> {
  return decodeResponse<ResumeVersion>(await fetch("/api/resumes/" + encodeURIComponent(resumeId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...profileHeaders(profileId) },
    body: JSON.stringify({ name }),
  }), "Could not rename resume.");
}
export async function deleteResumeVersion(profileId: string, resumeId: string): Promise<void> {
  await decodeResponse(await fetch("/api/resumes/" + encodeURIComponent(resumeId), {
    method: "DELETE", headers: profileHeaders(profileId),
  }), "Could not delete resume.");
}
