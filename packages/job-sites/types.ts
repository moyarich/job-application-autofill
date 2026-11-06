import type { Page } from "playwright";
import type { CandidateProfile } from "../resume/src/types.ts";

export type ContactField = keyof CandidateProfile["contact"] | "fullName";
export type AutofillResult = { filled: string[]; missing: string[] };
export type ResumeRetryResult = AutofillResult & { uploaded: boolean };
export type BrowserSignInSession = { page: Page; loginAttempted?: boolean };

/**
 * A job-site adapter owns provider-specific selectors, account identity and
 * optional browser behaviors. Shared automation owns session lifecycle.
 */
export interface JobSiteAdapter {
  readonly id: string;
  readonly label: string;
  readonly hosts: readonly string[];
  readonly fields: Partial<Record<ContactField, RegExp[]>>;
  employerTenant(url: URL): string | undefined;
  skipContactField?(page: Page, field: ContactField): Promise<boolean>;
  fillProfile?(page: Page, profile: CandidateProfile): Promise<AutofillResult>;
  retryResumeUpload?(page: Page, file: string, uploadedUrls: string[]): Promise<ResumeRetryResult>;
  openApplication?(page: Page): Promise<void>;
  helpSignIn?(session: BrowserSignInSession): Promise<void>;
  loginFailureMessage?(text: string): string | null;
}
