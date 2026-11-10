import type { Resume } from "@moyarich/resume";
import { v5 as uuidv5 } from "uuid";
import { parseResumeJson } from "@moyarich/resume/validate";
export type ApplicationStatus =
  | "saved"
  | "in_progress"
  | "ready_for_review"
  | "submitted"
  | "interview"
  | "rejected";

export type { Resume, EmploymentEntry } from "@moyarich/resume";

export type JobPostingDetails = {
  salary?: string;
  location?: string;
  employmentType?: string;
  requisitionId?: string;
  description?: string;
  postingUrl?: string;
};
export interface JobApplication {
  id: string;
  company: string;
  role: string;
  url: string;
  status: ApplicationStatus;
  createdAt: string;
  notes: string;
  resumeId?: string | null;
  accountAction?: "signup" | "login";
  details?: JobPostingDetails;
}

export const emptyCandidate: Resume = {
  contact: {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    linkedIn: "",
    github: "",
    website: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    phoneCountryCode: "",
    phoneType: "",
  },
  summary: "",
  experience: [],
  skills: [],
  education: [],
  projects: [],
  certifications: [],
  languages: [],
  awards: [],
  source: { fileName: "" },
};

export const statuses: readonly ApplicationStatus[] = [
  "saved",
  "in_progress",
  "ready_for_review",
  "submitted",
  "interview",
  "rejected",
];

export function validateCandidate(profile: Resume): string[] {
  const errors: string[] = [];
  if (!profile.contact.firstName.trim()) errors.push("First name is required");
  if (!profile.contact.lastName.trim()) errors.push("Last name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.contact.email.trim()))
    errors.push("Valid email is required");
  return errors;
}
export function parseCandidateJson(text: string): Resume {
  return parseResumeJson(text) as Resume;
}

export function createApplication(
  company: string,
  role: string,
  url: string,
): JobApplication {
  const trimmedUrl = url.trim();
  if (!company.trim() || !role.trim())
    throw new Error("Company and role are required");
  if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl))
    throw new Error("Job URL must begin with http:// or https://");
  const identity = JSON.stringify([company.trim(), role.trim(), trimmedUrl]);
  return {
    id: uuidv5(identity, uuidv5.URL),
    company: company.trim(),
    role: role.trim(),
    url: trimmedUrl,
    status: "saved",
    createdAt: new Date().toISOString(),
    notes: "",
  };
}
