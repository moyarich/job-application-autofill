export type ApplicationStatus = "saved" | "in_progress" | "ready_for_review" | "submitted" | "interview" | "rejected";

export interface CandidateProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  linkedIn: string;
  github: string;
  website: string;
  summary: string;
  skills: string;
  resumeFileName: string;
}

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  url: string;
  status: ApplicationStatus;
  createdAt: string;
  notes: string;
}

export const emptyCandidate: CandidateProfile = {
  firstName: "", lastName: "", email: "", phone: "", location: "",
  linkedIn: "", github: "", website: "", summary: "", skills: "",
  resumeFileName: "",
};

export const statuses: readonly ApplicationStatus[] = [
  "saved", "in_progress", "ready_for_review", "submitted", "interview", "rejected",
];

export function validateCandidate(value: CandidateProfile): string[] {
  const errors: string[] = [];
  if (!value.firstName.trim()) errors.push("First name is required");
  if (!value.lastName.trim()) errors.push("Last name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) errors.push("Valid email is required");
  return errors;
}

export function parseCandidateJson(text: string): CandidateProfile {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error("Profile must be a JSON object");
  const object = parsed as Record<string, unknown>;
  const profile = { ...emptyCandidate };
  for (const key of Object.keys(profile) as (keyof CandidateProfile)[]) {
    if (object[key] != null) {
      if (typeof object[key] !== "string") throw new Error(`Field "${key}" must be a string`);
      profile[key] = object[key] as string;
    }
  }
  return profile;
}

export function createApplication(company: string, role: string, url: string): JobApplication {
  const trimmedUrl = url.trim();
  if (!company.trim() || !role.trim()) throw new Error("Company and role are required");
  if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) throw new Error("Job URL must begin with http:// or https://");
  return { id: crypto.randomUUID(), company: company.trim(), role: role.trim(),
    url: trimmedUrl, status: "saved", createdAt: new Date().toISOString(), notes: "" };
}
