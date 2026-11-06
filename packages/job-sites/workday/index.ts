import type { JobSiteAdapter } from "../types.ts";
import { workdayEmployerTenant } from "./identity.ts";
import { detectWorkdayPage } from "./detection.ts";
import { workdaySteps, workdayScreening } from "./steps.ts";
import { helpWorkdaySignIn, openWorkdayApplication, workdayLoginFailureMessage } from "./workday-login.ts";

// Workday adapter.
export default {
  id: "workday",
  label: "Workday",
  hosts: ["myworkdayjobs.com", "workday.com"],
  employerTenant: (url: URL) => workdayEmployerTenant(url.hostname),
  detectPage: detectWorkdayPage,
  steps: workdaySteps,
  menuItems: [
    { id: "personal-information", label: "Personal information", stepId: "workday.personal-information" },
    { id: "work-experience", label: "Work experience", stepId: "workday.work-experience" },
    { id: "education", label: "Education", stepId: "workday.education" },
    { id: "skills", label: "Skills", stepId: "workday.skills" },
    { id: "resume", label: "Resume upload", stepId: "workday.resume" },
    { id: "screening", label: "Screening questions", stepId: "workday.screening" },
  ],
  discoverQuestions: workdayScreening.discover,
  answerQuestions: workdayScreening.answer,
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
