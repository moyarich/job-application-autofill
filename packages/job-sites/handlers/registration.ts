import type { Page } from "playwright";
import type { CandidateProfile } from "../../resume/src/types.ts";
import { prepareEmployerSignUp } from "../account-sign-up.ts";

/** Prepare an employer account; never consent, solve challenges, or submit. */
export async function prepareRegistration(
  page: Page,
  jobUrl: string,
  company: string,
  profile: CandidateProfile,
  options: { openRegistration?: boolean; password?: string } = {},
) {
  return prepareEmployerSignUp(page, jobUrl, company, profile, options);
}
