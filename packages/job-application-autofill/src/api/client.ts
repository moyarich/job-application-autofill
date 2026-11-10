import { Resume } from "@moyarich/resume";
import { JobApplication } from "../types/job-application";
import {
  AnswersResponse,
  ContactChoice,
  LocalProfile,
  ProfileContact,
  ResumeVersion,
} from "../types/api-types";

export const DEFAULT_PROFILE_ID = "00000000-0000-4000-8000-000000000001";
export const ACTIVE_PROFILE_STORAGE_KEY =
  "job-application-autofill:active-profile";

export async function fetchAnswers(
  applicationId: string,
  profileId: string,
  signal?: AbortSignal,
): Promise<AnswersResponse> {
  const response = await fetch(
    `/api/applications/${encodeURIComponent(applicationId)}/answers`,
    {
      headers: { "X-Moya-Client": "dashboard", "X-Profile-Id": profileId },
      cache: "no-store",
      signal,
    },
  );
  if (!response.ok) throw new Error("Could not reload saved answers.");
  return response.json();
}

export async function resolveImportedContact(
  profileId: string,
  resumeId: string,
  contact: Resume["contact"],
  choices: Partial<Record<keyof Resume["contact"], ContactChoice>>,
): Promise<{
  contactId: string | null;
  contact: Resume["contact"];
  contacts: ProfileContact[];
}> {
  return requestApi(
    "/api/profile-contacts/import",
    { resumeId, contact, choices },
    profileId,
    resumeId,
  );
}
export async function addProfileContact(
  profileId: string,
  name: string,
  contact: Resume["contact"],
): Promise<ProfileContact> {
  return requestApi("/api/profile-contacts", { name, contact }, profileId);
}
export async function updateProfileContact(
  profileId: string,
  contactId: string,
  name: string,
  contact: Resume["contact"],
): Promise<ProfileContact> {
  const response = await fetch(
    "/api/profile-contacts/" + encodeURIComponent(contactId),
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...profileHeaders(profileId),
      },
      body: JSON.stringify({ name, contact }),
    },
  );
  return decodeResponse<ProfileContact>(response, "Could not update contact.");
}
export async function deleteProfileContact(
  profileId: string,
  contactId: string,
): Promise<void> {
  const response = await fetch(
    "/api/profile-contacts/" + encodeURIComponent(contactId),
    {
      method: "DELETE",
      headers: profileHeaders(profileId),
    },
  );
  await decodeResponse(response, "Could not delete contact.");
}
export async function chooseDefaultContact(
  profileId: string,
  contactId: string,
): Promise<ProfileContact> {
  return requestApi(
    "/api/profile-contacts/" + encodeURIComponent(contactId) + "/default",
    {},
    profileId,
  );
}

const profileHeaders = (profileId: string, resumeId?: string) => ({
  "X-Moya-Client": "dashboard",
  "X-Profile-Id": profileId,
  ...(resumeId ? { "X-Resume-Id": resumeId } : {}),
});
async function decodeResponse<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || fallback);
  return result as T;
}
export async function requestApi<T>(
  url: string,
  data: unknown,
  profileId = DEFAULT_PROFILE_ID,
  resumeId?: string,
): Promise<T> {
  return decodeResponse<T>(
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...profileHeaders(profileId, resumeId),
      },
      body: JSON.stringify(data),
    }),
    "Local API request failed",
  );
}
export type ResumeContent = {
  resumeId: string;
  revision: number;
  contactId: string | null;
  profile: Resume | null;
};
export type JobList = {
  jobs: JobApplication[];
  revisions: Record<string, number>;
};

export async function readProfiles(): Promise<{
  profiles: LocalProfile[];
  defaultProfileId: string;
}> {
  return decodeResponse(
    await fetch("/api/profiles", {
      headers: profileHeaders(DEFAULT_PROFILE_ID),
      cache: "no-store",
    }),
    "Could not list local profiles.",
  );
}

export async function createLocalProfile(name: string): Promise<LocalProfile> {
  return requestApi("/api/profiles", { name });
}
export async function renameLocalProfile(
  profileId: string,
  name: string,
): Promise<LocalProfile> {
  return decodeResponse(
    await fetch("/api/profiles/" + encodeURIComponent(profileId), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...profileHeaders(profileId),
      },
      body: JSON.stringify({ name }),
    }),
    "Could not rename profile.",
  );
}
export async function deleteLocalProfile(profileId: string): Promise<void> {
  await decodeResponse(
    await fetch("/api/profiles/" + encodeURIComponent(profileId), {
      method: "DELETE",
      headers: profileHeaders(profileId),
    }),
    "Could not delete profile.",
  );
}
export async function readResumes(profileId: string): Promise<ResumeVersion[]> {
  const result = await decodeResponse<{ resumes: ResumeVersion[] }>(
    await fetch("/api/resumes", {
      headers: profileHeaders(profileId),
      cache: "no-store",
    }),
    "Could not load resumes.",
  );
  return result.resumes;
}

export async function readContacts(
  profileId: string,
): Promise<ProfileContact[]> {
  const result = await decodeResponse<{ contacts: ProfileContact[] }>(
    await fetch("/api/profile-contacts", {
      headers: profileHeaders(profileId),
      cache: "no-store",
    }),
    "Could not load contacts.",
  );
  return result.contacts;
}

export async function readResumeContent(
  profileId: string,
  resumeId: string,
): Promise<ResumeContent> {
  return decodeResponse<ResumeContent>(
    await fetch("/api/resumes/" + encodeURIComponent(resumeId) + "/content", {
      headers: profileHeaders(profileId),
      cache: "no-store",
    }),
    "Could not load resume content.",
  );
}
export async function saveResumeContent(
  profileId: string,
  resumeId: string,
  content: {
    revision: number;
    profile: Resume;
    contactId: string | null;
  },
): Promise<{ revision: number }> {
  return decodeResponse<{ revision: number }>(
    await fetch("/api/resumes/" + encodeURIComponent(resumeId) + "/content", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...profileHeaders(profileId),
      },
      body: JSON.stringify(content),
    }),
    "Could not save resume content.",
  );
}

export async function readJobs(profileId: string): Promise<JobList> {
  return decodeResponse<JobList>(
    await fetch("/api/jobs", {
      headers: profileHeaders(profileId),
      cache: "no-store",
    }),
    "Could not load applications.",
  );
}
export async function saveJob(
  profileId: string,
  payload: { revision: number; job: JobApplication },
): Promise<{ revision: number }> {
  return decodeResponse<{ revision: number }>(
    await fetch("/api/jobs", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...profileHeaders(profileId),
      },
      body: JSON.stringify(payload),
    }),
    "Could not save application.",
  );
}
export async function deleteJob(
  profileId: string,
  jobId: string,
  revision: number,
): Promise<{ deleted: true }> {
  return decodeResponse<{ revision: number; deleted: true }>(
    await fetch("/api/jobs/" + encodeURIComponent(jobId), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...profileHeaders(profileId),
      },
      body: JSON.stringify({ revision }),
    }),
    "Could not delete application.",
  );
}

export async function createResumeVersion(
  profileId: string,
  name: string,
  copyId?: string,
): Promise<ResumeVersion> {
  return requestApi<ResumeVersion>("/api/resumes", { name, copyId }, profileId);
}
export async function renameResumeVersion(
  profileId: string,
  resumeId: string,
  name: string,
): Promise<ResumeVersion> {
  return decodeResponse<ResumeVersion>(
    await fetch("/api/resumes/" + encodeURIComponent(resumeId), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...profileHeaders(profileId),
      },
      body: JSON.stringify({ name }),
    }),
    "Could not rename resume.",
  );
}
export async function deleteResumeVersion(
  profileId: string,
  resumeId: string,
): Promise<void> {
  await decodeResponse(
    await fetch("/api/resumes/" + encodeURIComponent(resumeId), {
      method: "DELETE",
      headers: profileHeaders(profileId),
    }),
    "Could not delete resume.",
  );
}
