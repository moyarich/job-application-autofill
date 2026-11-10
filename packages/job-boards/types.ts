import type { Page } from "playwright";
import type { Resume } from "@moyarich/resume";
import type { ApplicationQuestion } from "./index.ts";

export type AutofillResult = { filled: string[]; missing: string[] };
export type BrowserSignInSession = { page: Page; loginAttempted?: boolean };
export type PageKind =
  "application" | "registration" | "sign_in" | "challenge" | "external";
export type PageDetection = { kind: PageKind; url: string };

/** Inputs shared by site-owned steps; no predefined section names or order. */
export interface JobSiteStepContext {
  page: Page;
  profile: Resume;
  directory: string;
  pendingResume: { fileName: string; buffer: Buffer } | null;
  resumeFile?: string;
  resumeUploadUrls?: string[];
}

/** A site may return any subset of these outcome fields. */
export interface JobSiteStepResult extends AutofillResult {
  questions?: ApplicationQuestion[];
  pendingResume?: JobSiteStepContext["pendingResume"];
  resumeFile?: string;
  resumeUploadUrls?: string[];
}

/** A job site defines its own named operations, detection and ordering. */
export interface JobSiteStep {
  readonly id: string;
  matches(context: JobSiteStepContext): Promise<boolean>;
  run(context: JobSiteStepContext): Promise<JobSiteStepResult>;
  inspectStatus?(
    context: JobSiteStepContext,
  ): Promise<"filled" | "needs_review" | "ready" | undefined>;
}

/** Visible menu action declared by the job site's own adapter. */
export interface JobSiteMenuItem {
  readonly id: string;
  readonly label: string;
  readonly stepId: string;
}

/**
 * Provider Strategy/Adapter contract.
 * No global section enumeration, generic form fallback, or forced capabilities.
 */
export interface JobSiteAdapter {
  readonly id: string;
  readonly label: string;
  readonly hosts: readonly string[];
  employerTenant(url: URL): string | undefined;
  readonly steps?: readonly JobSiteStep[];
  readonly menuItems?: readonly JobSiteMenuItem[];
  detectPage?(page: Page, text: string): Promise<PageKind | null>;
  openApplication?(page: Page): Promise<void>;
  helpSignIn?(session: BrowserSignInSession): Promise<void>;
  loginFailureMessage?(text: string): string | null;
  discoverQuestions?(page: Page): Promise<ApplicationQuestion[]>;
  answerQuestions?(
    page: Page,
    answers: Record<string, string>,
  ): Promise<{ filled: string[]; unresolved: string[] }>;
}
