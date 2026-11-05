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
  contact: { firstName: string; lastName: string; email: string; phone: string; location: string; linkedIn: string; github: string; website: string };
  summary: string;
  experience: EmploymentEntry[];
  skills: string[];
  education: { institution: string; degree: string; fieldOfStudy: string; location: string; startDate: string; endDate: string | null; description: string }[];
  projects: { name: string; description: string; url: string; technologies: string[] }[];
  certifications: { name: string; issuer: string; issuedDate: string; expirationDate: string | null; credentialId: string; url: string }[];
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
}

export const emptyCandidate: CandidateProfile = {
  contact: { firstName:"",lastName:"",email:"",phone:"",location:"",linkedIn:"",github:"",website:"" },
  summary:"", experience:[], skills:[], education:[], projects:[], certifications:[], languages:[], awards:[], source:{fileName:""},
};

export const statuses: readonly ApplicationStatus[] = [
  "saved", "in_progress", "ready_for_review", "submitted", "interview", "rejected",
];

export function validateCandidate(profile: CandidateProfile): string[] {
  const errors: string[] = [];
  if (!profile.contact.firstName.trim()) errors.push("First name is required");
  if (!profile.contact.lastName.trim()) errors.push("Last name is required");
  if (!/^[^\s@]+@[^\s@]+\\.[^\s@]+$/.test(profile.contact.email.trim())) errors.push("Valid email is required");
  return errors;
}
export function parseCandidateJson(text: string): CandidateProfile {
  const raw: unknown = JSON.parse(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Resume must be a JSON object");
  const data = raw as Record<string, unknown>;
  if (!data.contact || typeof data.contact !== "object" || Array.isArray(data.contact)) throw new Error("Resume contact is required");
  const contact = data.contact as Record<string, unknown>;
  for (const key of Object.keys(emptyCandidate.contact))
    if (typeof contact[key] !== "string") throw new Error("Invalid contact field: " + key);
  if (typeof data.summary !== "string") throw new Error("Summary must be a string");
  for (const key of ["experience","skills","education","projects","certifications","languages","awards"])
    if (!Array.isArray(data[key])) throw new Error("Resume " + key + " must be an array");
  if (!data.source || typeof data.source !== "object" || Array.isArray(data.source)
      || typeof (data.source as Record<string, unknown>).fileName !== "string")
    throw new Error("Resume source.fileName is required");
  for (const key of ["skills","languages","awards"])
    if (!(data[key] as unknown[]).every(value => typeof value === "string"))
      throw new Error(key + " must contain strings");
  const stringFields: Record<string,string[]> = {
    experience:["company","jobTitle","location","startDate","description"],
    education:["institution","degree","fieldOfStudy","location","startDate","description"],
    projects:["name","description","url"],
    certifications:["name","issuer","issuedDate","credentialId","url"],
  };
  const date = (value: unknown) => typeof value === "string" && (!value || /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/.test(value));
  for (const [section,keys] of Object.entries(stringFields)) {
    for (const value of data[section] as unknown[]) {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid " + section + " entry");
      const entry = value as Record<string, unknown>;
      for (const key of keys) if (typeof entry[key] !== "string") throw new Error(section + "." + key + " must be a string");
      if ((section === "experience" || section === "education") && (!date(entry.startDate) || (entry.endDate !== null && !date(entry.endDate))))
        throw new Error("Invalid employment or education dates");
      if (section === "experience" && typeof entry.isCurrent !== "boolean") throw new Error("isCurrent must be boolean");
      if (section === "certifications" && (!date(entry.issuedDate) || (entry.expirationDate !== null && !date(entry.expirationDate))))
        throw new Error("Invalid certification dates");
      if (section === "projects" && (!Array.isArray(entry.technologies) || !entry.technologies.every(x=>typeof x==="string")))
        throw new Error("Invalid project technologies");
    }
  }
  return raw as CandidateProfile;
}
export function createApplication(company: string, role: string, url: string): JobApplication {
  const trimmedUrl = url.trim();
  if (!company.trim() || !role.trim()) throw new Error("Company and role are required");
  if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) throw new Error("Job URL must begin with http:// or https://");
  return { id: crypto.randomUUID(), company: company.trim(), role: role.trim(),
    url: trimmedUrl, status: "saved", createdAt: new Date().toISOString(), notes: "" };
}
