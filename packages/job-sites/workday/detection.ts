import type { Page } from "playwright";
import type { PageKind } from "../types.ts";

/** Workday pages may put sign-in and registration inside the application path. */
export async function detectWorkdayPage(_page: Page, text: string): Promise<PageKind | null> {
  if (/(?:^|\n)\s*(?:create (?:an? )?account)\s*(?:\n|$)/i.test(text))
    return "registration";
  if (/(?:^|\n)\s*(?:sign in|log in)\s*(?:\n|$)/i.test(text))
    return "sign_in";
  return null;
}
