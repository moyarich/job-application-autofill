import { detectCurrentPage } from "./state-machine.ts";
import type { JobSiteAdapter, JobSiteStepContext, PageDetection } from "../types.ts";
import type { ApplicationQuestion } from "../index.ts";

export type StepContext = JobSiteStepContext & { expectedHost: string };
export interface StepOutcome {
  detection: PageDetection;
  filled: string[];
  missing: string[];
  executed: string[];
  questions: ApplicationQuestion[];
  pendingResume: JobSiteStepContext["pendingResume"];
  resumeFile?: string;
  resumeUploadUrls?: string[];
}

/**
 * Execute only the current provider's matching steps.
 * The provider defines step identities, applicability, and DOM behavior.
 * The orchestrator validates the destination before and after every step.
 */
export async function automateCurrentStep(
  context: StepContext,
  adapter: JobSiteAdapter,
): Promise<StepOutcome> {
  const detection = await detectCurrentPage(context.page, adapter, context.expectedHost);
  const outcome: StepOutcome = {
    detection, filled: [], missing: [], executed: [], questions: [],
    pendingResume: context.pendingResume,
    resumeFile: context.resumeFile,
    resumeUploadUrls: context.resumeUploadUrls,
  };
  if (detection.kind !== "application") return outcome;

  for (const step of adapter.steps ?? []) {
    const before = await detectCurrentPage(context.page, adapter, context.expectedHost);
    if (before.kind !== "application") {
      outcome.detection = before;
      break;
    }
    const current: JobSiteStepContext = {
      page: context.page, profile: context.profile, directory: context.directory,
      pendingResume: outcome.pendingResume, resumeFile: outcome.resumeFile,
      resumeUploadUrls: outcome.resumeUploadUrls,
    };
    if (!(await step.matches(current))) continue;
    const result = await step.run(current);
    outcome.executed.push(step.id);
    outcome.filled.push(...result.filled);
    outcome.missing.push(...result.missing);
    if (result.questions !== undefined) outcome.questions = result.questions;
    if ("pendingResume" in result) outcome.pendingResume = result.pendingResume ?? null;
    if ("resumeFile" in result) outcome.resumeFile = result.resumeFile;
    if ("resumeUploadUrls" in result) outcome.resumeUploadUrls = result.resumeUploadUrls;
    const after = await detectCurrentPage(context.page, adapter, context.expectedHost);
    if (after.kind !== "application") {
      outcome.detection = after;
      break;
    }
  }
  return outcome;
}
