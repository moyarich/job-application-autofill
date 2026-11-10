import { Resume } from "@moyarich/resume";
import { ApplicationStatus } from "../types/job-application";

export const STATUSES: readonly ApplicationStatus[] = [
  "saved",
  "in_progress",
  "ready_for_review",
  "submitted",
  "interview",
  "rejected",
];

export const EMPTY_CANDIDATE: Resume = {
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
