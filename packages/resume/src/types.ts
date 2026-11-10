export interface EmploymentEntry {
  company: string;
  jobTitle: string;
  location: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  description: string;
}

export interface Resume {
  contact: {
    firstName: string;
    lastName: string;
    middleName?: string;
    preferredName?: string;
    email: string;
    phone: string;
    location: string;
    linkedIn: string;
    github: string;
    website: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phoneCountryCode?: string;
    phoneType?: string;
  };
  additionalSections?: { heading: string; content: string }[];
  skillGroups?: { heading: string; content: string }[];
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
