export type ApplicationStatus = "saved" | "in_progress" | "ready_for_review" | "submitted" | "interview" | "rejected";

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
  experience: EmploymentEntry[];
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
  resumeFileName: "", experience: [],
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
    if (key === "experience") continue;
    if (object[key] != null) {
      if (typeof object[key] !== "string") throw new Error(`Field "${key}" must be a string`);
      (profile as unknown as Record<string, unknown>)[key] = object[key];
    }
  }
  if (object.experience !== undefined) {
    if (!Array.isArray(object.experience) || object.experience.length > 40)
      throw new Error("Employment history must be an array of at most 40 entries.");
    profile.experience = object.experience.map((raw: unknown) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid employment entry.");
      const entry = raw as Record<string, unknown>;
      for (const key of ["company", "jobTitle", "location", "startDate", "description"])
        if (typeof entry[key] !== "string") throw new Error("Employment " + key + " must be a string.");
      if (entry.endDate !== null && typeof entry.endDate !== "string")
        throw new Error("Employment endDate must be a string or null.");
      if (typeof entry.isCurrent !== "boolean") throw new Error("Employment isCurrent must be a boolean.");
      const validDate = (value: string) => !value || /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/.test(value);
      if (!validDate(entry.startDate as string) || (entry.endDate !== null && !validDate(entry.endDate as string)))
        throw new Error("Employment date must use YYYY or YYYY-MM.");
      return {
        company:entry.company as string, jobTitle:entry.jobTitle as string,
        location:entry.location as string, startDate:entry.startDate as string,
        endDate:entry.endDate as string | null, isCurrent:entry.isCurrent as boolean,
        description:entry.description as string,
      };
    });
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
