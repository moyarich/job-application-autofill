import type { JobSiteAdapter } from "../types.ts";
import { workdayEmployerTenant } from "./identity.ts";
import { retryWorkdayResumeUpload, skipWorkdayLocation } from "./autofill.ts";
import { fillWorkdayExperience } from "./experience.ts";
import { fillWorkdayEducation } from "./education.ts";
import { fillWorkdaySkills } from "./skills.ts";
import { detectWorkdayPage } from "./detection.ts";
import { helpWorkdaySignIn, openWorkdayApplication, workdayLoginFailureMessage } from "./workday-login.ts";

// Workday adapter.
export default {
  id: "workday",
  label: "Workday",
  hosts: ["myworkdayjobs.com", "workday.com"],
  employerTenant: (url: URL) => workdayEmployerTenant(url.hostname),
  skipContactField: async (page, field) => field === "location" && await skipWorkdayLocation(page),
  detectPage: detectWorkdayPage,
  fillEmployment: async (page, profile) => {
    if (!profile.experience?.length) return { filled: [], missing: [] };
    const result = await fillWorkdayExperience(page, profile.experience);
    return { filled: result.filled, missing: result.unresolved };
  },
  fillEducation: async (page, profile) => {
    const result = await fillWorkdayEducation(page, profile.education || []);
    return { filled: result.filled, missing: result.unresolved };
  },
  fillSkills: async (page, profile) => {
    const result = await fillWorkdaySkills(page, profile.skills || []);
    return { filled: result.filled, missing: result.unresolved };
  },
  retryResumeUpload: retryWorkdayResumeUpload,
  openApplication: openWorkdayApplication,
  helpSignIn: helpWorkdaySignIn,
  loginFailureMessage: workdayLoginFailureMessage,
  fields: {
    firstName: [/first.?name/i],
    lastName: [/last.?name/i],
    email: [/email/i],
    phone: [/^phone number\s*\*?$/i],
    location: [/^location\s*\*?$/i],
    linkedIn: [/linkedin/i],
    github: [/github/i],
    website: [/website|portfolio/i],
  },
} satisfies JobSiteAdapter;
