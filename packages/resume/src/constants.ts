import { Resume } from "./types";

/** Empty resume, handy as an initial form/state value. */
export const EMPTY_RESUME = (fileName = ""): Resume => ({
  contact: {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    linkedIn: "",
    github: "",
    website: "",
  },
  summary: "",
  experience: [],
  skills: [],
  skillGroups: [],
  education: [],
  projects: [],
  certifications: [],
  languages: [],
  awards: [],
  additionalSections: [],
  source: { fileName },
});
