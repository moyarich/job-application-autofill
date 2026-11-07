import { handleProfiles } from "./profiles.ts";
import { handleEmployerAccounts } from "./employer-accounts.ts";
import { handleContacts } from "./contacts.ts";
import { handleResumes } from "./resumes.ts";
import { handleJobs } from "./jobs.ts";
import { handleResumeProcessing } from "./resume-processing.ts";
import { handleApplications } from "./applications.ts";
import type { RouteHandler } from "../server/types.ts";
export const routes: readonly RouteHandler[] = [handleProfiles, handleEmployerAccounts, handleContacts, handleResumes, handleJobs, handleResumeProcessing, handleApplications];
