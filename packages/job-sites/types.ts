import type { Page } from "playwright";
import type { CandidateProfile } from "../resume/src/types.ts";

export type ContactField = keyof CandidateProfile["contact"] | "fullName";
export type AutofillResult = { filled: string[]; missing: string[] };
export type ResumeRetryResult = AutofillResult & { uploaded: boolean };
export type BrowserSignInSession = { page: Page; loginAttempted?: boolean };
export type ApplicationStep = "contact" | "employment" | "education" | "skills" | "resume" | "screening";
export type PageKind = "application" | "registration" | "sign_in" | "challenge" | "external";
export type PageDetection = { kind: PageKind; url: string };

/**
 * A provider strategy translates an ATS's pages and controls into common
 * application operations. The orchestrator owns ordering and safety gates.
 */
export interface JobSiteAdapter {
  readonly id: string;
  readonly label: string;
  readonly hosts: readonly string[];
  readonly fields: Partial<Record<ContactField, RegExp[]>>;
  employerTenant(url: URL): string | undefined;

  // Page recognition and account capabilities.
  detectPage?(page: Page, text: string): Promise<PageKind | null>;
  openApplication?(page: Page): Promise<void>;
  helpSignIn?(session: BrowserSignInSession): Promise<void>;
  loginFailureMessage?(text: string): string | null;

  // Form capabilities. Unsupported operations remain visible for manual review.
  skipContactField?(page: Page, field: ContactField): Promise<boolean>;
  fillContact?(page: Page, profile: CandidateProfile): Promise<AutofillResult>;
  fillEmployment?(page: Page, profile: CandidateProfile): Promise<AutofillResult>;
  fillEducation?(page: Page, profile: CandidateProfile): Promise<AutofillResult>;
  fillSkills?(page: Page, profile: CandidateProfile): Promise<AutofillResult>;
  retryResumeUpload?(page: Page, file: string, uploadedUrls: string[]): Promise<ResumeRetryResult>;

  // Backwards-compatible grouped provider hook (new integrations should use
  // the individual employment/education/skills strategies instead).
  fillProfile?(page: Page, profile: CandidateProfile): Promise<AutofillResult>;
}
