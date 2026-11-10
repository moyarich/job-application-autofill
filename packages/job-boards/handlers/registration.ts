import type { Page } from "playwright";
import type { CandidateProfile } from "../../resume/src/types.ts";
import { prepareEmployerSignUp } from "../account-sign-up.ts";

/** Prepare the requested employer account action without consenting or solving challenges. */
export async function prepareRegistration(
  page: Page,
  jobUrl: string,
  company: string,
  profile: CandidateProfile,
  options: {
    openRegistration?: boolean;
    password?: string;
    submitConfigured?: boolean;
  } = {},
) {
  return prepareEmployerSignUp(page, jobUrl, company, profile, options);
}
