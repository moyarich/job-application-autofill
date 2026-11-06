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

