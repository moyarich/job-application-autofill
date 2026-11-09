import { v5 as uuidv5 } from "uuid";
import { parseResumeJson } from "@moyarich/resume/validate";
export type ApplicationStatus =
  | "saved"
  | "in_progress"
  | "ready_for_review"
  | "submitted"
  | "interview"
  | "rejected";

export interface EmploymentEntry {
  company: string;
  jobTitle: string;
  location: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  description: string;
}

export interface CandidateProfile {
  additionalSections?: { heading: string; content: string }[];
  skillGroups?: { heading: string; content: string }[];
  contact: import("@moyarich/resume").CandidateProfile["contact"];
  summary: string;
  experience: EmploymentEntry[];
  skills: string[];
  education: {
    institution: string;
    degree: string;
    fieldOfStudy: string;
    location: string;
    startDate: string;
    endDate: string | null;
    description: string;
  }[];
  projects: {
    name: string;
    description: string;
    url: string;
    technologies: string[];
  }[];
  certifications: {
    name: string;
    issuer: string;
    issuedDate: string;
    expirationDate: string | null;
    credentialId: string;
    url: string;
  }[];
  languages: string[];
  awards: string[];
  source: { fileName: string };
}

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  url: string;
  status: ApplicationStatus;
  createdAt: string;
  notes: string;
  resumeId?: string | null;
}

export const emptyCandidate: CandidateProfile = {
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

export function validateCandidate(profile: CandidateProfile): string[] {
  const errors: string[] = [];
  if (!profile.contact.firstName.trim()) errors.push("First name is required");
  if (!profile.contact.lastName.trim()) errors.push("Last name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.contact.email.trim()))
    errors.push("Valid email is required");
  return errors;
}
export function parseCandidateJson(text: string): CandidateProfile {
  return parseResumeJson(text) as CandidateProfile;
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
