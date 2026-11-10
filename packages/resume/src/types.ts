export interface EmploymentEntry {
  company: string;
  jobTitle: string;
  location: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  description: string;
}
export type EmploymentKey = keyof EmploymentEntry;

export interface Contact {
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
}
export type ContactKey = keyof Contact;

export interface IEducation {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  location: string;
  startDate: string;
  endDate: string | null;
  description: string;
}
export type EducationKey = keyof IEducation;

export interface ISection {
  heading: string;
  content: string;
}

export interface IProject {
  name: string;
  description: string;
  url: string;
  technologies: string[];
}
export type ProjectKey = keyof IProject;

export interface ICertification {
  name: string;
  issuer: string;
  issuedDate: string;
  expirationDate: string | null;
  credentialId: string;
  url: string;
}
export type CertificationKey = keyof ICertification;

export interface Resume {
  contact: Contact;
  summary: string;
  experience: EmploymentEntry[];
  skills: string[];
  skillGroups?: ISection[];
  education: IEducation[];
  projects: IProject[];
  certifications: ICertification[];
  languages: string[];
  awards: string[];
  additionalSections?: ISection[];
  source: { fileName: string };
}
export type ResumeKey = keyof Resume;
