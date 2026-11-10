import { detectCurrentPage } from "./state-machine.ts";
import type {
  JobSiteAdapter,
  JobSiteStepContext,
  PageDetection,
} from "../types.ts";
import type { ApplicationQuestion } from "../index.ts";

export type StepContext = JobSiteStepContext & {
  expectedHost: string;
  onStep?: (stepId: string | null) => void;
  onStepResult?: (stepId: string, missing: string[]) => void;
  processedSteps?: Record<string, "processed" | "needs_review">;
};
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
  selectedStepId?: string,
): Promise<StepOutcome> {
  const detection = await detectCurrentPage(
    context.page,
    adapter,
    context.expectedHost,
  );
  const outcome: StepOutcome = {
    detection,
    filled: [],
    missing: [],
    executed: [],
    questions: [],
    pendingResume: context.pendingResume,
    resumeFile: context.resumeFile,
    resumeUploadUrls: context.resumeUploadUrls,
  };
  if (detection.kind !== "application") return outcome;

  for (const step of adapter.steps ?? []) {
    if (selectedStepId && step.id !== selectedStepId) continue;
    const before = await detectCurrentPage(
      context.page,
      adapter,
      context.expectedHost,
    );
    if (before.kind !== "application") {
      outcome.detection = before;
      break;
    }
    const current: JobSiteStepContext = {
      page: context.page,
      profile: context.profile,
      directory: context.directory,
      pendingResume: outcome.pendingResume,
      resumeFile: outcome.resumeFile,
      resumeUploadUrls: outcome.resumeUploadUrls,
    };
    if (!(await step.matches(current))) continue;
    context.onStep?.(step.id);
    let result;
    try {
      result = await step.run(current);
      context.onStepResult?.(step.id, result.missing);
    } finally {
      context.onStep?.(null);
    }
    outcome.executed.push(step.id);
    outcome.filled.push(...result.filled);
    outcome.missing.push(...result.missing);
    if (result.questions !== undefined) outcome.questions = result.questions;
    if ("pendingResume" in result)
      outcome.pendingResume = result.pendingResume ?? null;
    if ("resumeFile" in result) outcome.resumeFile = result.resumeFile;
    if ("resumeUploadUrls" in result)
      outcome.resumeUploadUrls = result.resumeUploadUrls;
    const after = await detectCurrentPage(
      context.page,
      adapter,
      context.expectedHost,
    );
    if (after.kind !== "application") {
      outcome.detection = after;
      break;
    }
  }
  return outcome;
}

/** Public menu entries are looked up from the provider, not generated globally. */
export async function listJobSiteMenu(
  context: StepContext,
  adapter: JobSiteAdapter,
) {
  if (
    (await detectCurrentPage(context.page, adapter, context.expectedHost))
      .kind !== "application"
  )
    return [];
  const steps = new Map((adapter.steps ?? []).map((step) => [step.id, step]));
  const items: { id: string; label: string; available: boolean; status?: "processed" | "needs_review" | "filled" | "ready" }[] = [];
  for (const item of adapter.menuItems ?? []) {
    const step = steps.get(item.stepId);
    if (!step) continue;
    const available = await step.matches(context).catch(() => false);
    const observed = await step.inspectStatus?.(context).catch(() => undefined);
    const previous = context.processedSteps?.[item.stepId];
    const status = observed ?? previous;
    items.push({
      id: item.id,
      label: item.label,
      available,
      ...(status ? { status } : {}),
    });
  }
  return items;
}

/** Execute only one authorized, matching, site-owned menu operation. */
export async function executeJobSiteMenuItem(
  context: StepContext,
  adapter: JobSiteAdapter,
  itemId: string,
) {
  const item = adapter.menuItems?.find((entry) => entry.id === itemId);
  if (!item || !adapter.steps?.some((step) => step.id === item.stepId))
    throw new Error("Unknown employer menu action.");
  const result = await automateCurrentStep(context, adapter, item.stepId);
  if (
    !result.executed.includes(item.stepId) ||
    result.detection.kind !== "application"
  )
    throw new Error(
      "This action is unavailable or the employer page has changed. Review it manually.",
    );
  return result;
}
