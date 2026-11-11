import type { Resume } from "@moyarich/resume";
import { requestApi } from "./client";

export function generateResumePdf(
  profile: Resume,
  profileId: string,
  resumeId?: string,
) {
  return requestApi<{ base64: string }>(
    "/api/resume/pdf",
    profile,
    profileId,
    resumeId,
  );
}

export function parseResumeFile(
  attachment: unknown,
  profileId: string,
  resumeId?: string,
) {
  return requestApi<{
    profile: Resume;
    preview: string;
    warnings: string[];
  }>("/api/resume/parse", attachment, profileId, resumeId);
}

export function importResumeContent(
  payload: {
    resumeId: string | null;
    revision: number;
    name: string;
    profile: Resume;
    choices: Record<string, string>;
  },
  profileId: string,
) {
  return requestApi<{ resumeId: string; revision: number }>(
    "/api/resumes/import",
    payload,
    profileId,
  );
}
