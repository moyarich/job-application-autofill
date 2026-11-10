import type { Page } from "playwright";
import type { Resume } from "@moyarich/resume";
import { prepareEmployerSignUp } from "../account-sign-up.ts";

/** Prepare the requested employer account action without consenting or solving challenges. */
export async function prepareRegistration(
  page: Page,
  jobUrl: string,
  company: string,
  profile: Resume,
  options: {
    openRegistration?: boolean;
    password?: string;
    submitConfigured?: boolean;
  } = {},
) {
  return prepareEmployerSignUp(page, jobUrl, company, profile, options);
}
