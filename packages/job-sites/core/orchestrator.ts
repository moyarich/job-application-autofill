import type { CandidateProfile } from "../../resume/src/types.ts";
import { fillKnownFields } from "../handlers/contact.ts";
import { fillResumeStep, type ResumeStepContext } from "../handlers/resume.ts";
import { detectScreeningQuestions } from "../handlers/screening.ts";
import { detectCurrentPage } from "./state-machine.ts";
import type { JobSiteAdapter, AutofillResult, ApplicationStep, PageDetection } from "../types.ts";
import type { ApplicationQuestion } from "../index.ts";

export type StepContext = ResumeStepContext & { profile: CandidateProfile; expectedHost: string };
export interface StepOutcome {
  detection: PageDetection;
  filled: string[];
  missing: string[];
  executed: ApplicationStep[];
  questions: ApplicationQuestion[];
  pendingResume: ResumeStepContext["pendingResume"];
  resumeFile?: string;
  resumeUploadUrls?: string[];
}

/**
 * Current-step workflow: recognize the page, stop on login/challenge/redirect,
 * then dispatch independent, idempotent capabilities without clicking Next,
 * Submit, registration consent, or guessing screening answers.
 */
export async function automateCurrentStep(context: StepContext, adapter: JobSiteAdapter): Promise<StepOutcome> {
  const detection = await detectCurrentPage(context.page, adapter, context.expectedHost);
  const outcome: StepOutcome = {
    detection, filled: [], missing: [], executed: [], questions: [],
    pendingResume: context.pendingResume,
    resumeFile: context.resumeFile,
    resumeUploadUrls: context.resumeUploadUrls,
  };
  if (detection.kind !== "application") return outcome;

  const collect = (step: ApplicationStep, result: AutofillResult) => {
    outcome.executed.push(step);
    outcome.filled.push(...result.filled);
    outcome.missing.push(...result.missing);
  };
  // Every step remains independent so one employer can show several sections
  // together, while another splits them over separate pages.
  collect("contact", adapter.fillContact
    ? await adapter.fillContact(context.page, context.profile)
    : await fillKnownFields(context.page, context.profile));

  if (adapter.fillEmployment || adapter.fillEducation || adapter.fillSkills) {
    if (adapter.fillEmployment) collect("employment", await adapter.fillEmployment(context.page, context.profile));
    else if (context.profile.experience?.length)
      outcome.missing.push(`work experience (${context.profile.experience.length} entries; review in employer browser)`);
    if (adapter.fillEducation) collect("education", await adapter.fillEducation(context.page, context.profile));
    if (adapter.fillSkills) collect("skills", await adapter.fillSkills(context.page, context.profile));
  } else if (adapter.fillProfile) {
    // Existing third-party adapters can migrate to individual capabilities
    // incrementally without breaking their behavior.
    collect("employment", await adapter.fillProfile(context.page, context.profile));
  } else if (context.profile.experience?.length) {
    outcome.missing.push(`work experience (${context.profile.experience.length} entries; review in employer browser)`);
  }

  const resume = await fillResumeStep(context, adapter);
  collect("resume", resume);
  outcome.pendingResume = resume.pendingResume;
  outcome.resumeFile = resume.resumeFile;
  outcome.resumeUploadUrls = resume.resumeUploadUrls;

  outcome.questions = await detectScreeningQuestions(context.page).catch(() => []);
  outcome.executed.push("screening");
  return outcome;
}
