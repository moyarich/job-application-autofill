import type { Page, Locator } from "playwright";
import type { CandidateProfile } from "../resume/src/types.ts";
import { employerAccountIdentity } from "./employer-account.ts";

export type AccountSetupResult = {
  state: "unavailable" | "not_required" | "prepared" | "manual_required";
  filled: string[];
  missing: string[];
};

/**
 * Prepare an employer's registration form without accepting legal terms,
 * bypassing challenges, or clicking the final Create Account button.
 * A password, when supplied, exists only for this request.
 */
export async function prepareEmployerSignUp(
  page: Page,
  jobUrl: string,
  company: string,
  profile: CandidateProfile,
  { openRegistration = true, password }: { openRegistration?: boolean; password?: string } = {},
): Promise<AccountSetupResult> {
  const identity = employerAccountIdentity(jobUrl, company);
  const unavailable: AccountSetupResult = { state: "unavailable", filled: [], missing: [] };
  if (!identity) return unavailable;
  const safe = () => {
    try {
      const url = new URL(page.url());
      return url.protocol === "https:" && url.hostname.toLowerCase() === identity.host &&
        !url.username && !url.password;
    } catch { return false; }
  };
  if (!safe()) return unavailable;
  const visible = async (locator: Locator) => locator.isVisible({ timeout: 500 }).catch(() => false);
  const signupPage = async () => {
    if (!safe()) return false;
    const url = new URL(page.url());
    const body = (await page.locator("body").innerText().catch(() => "")).slice(0, 6000);
    return /(?:create[ -]?account|sign[ -]?up|register|registration)/i.test(url.pathname) ||
      /(?:create (?:an? |your )?account|sign up|register for an account)/i.test(body);
  };
  if (openRegistration && !(await signupPage())) {
    const choices = [
      page.getByRole("link", { name: /^(?:create (?:an? |your )?account|sign up|register)$/i }).first(),
      page.getByRole("button", { name: /^(?:create (?:an? |your )?account|sign up|register)$/i }).first(),
    ];
    for (const link of choices) {
      if (!(await visible(link))) continue;
      await link.click({ timeout: 2500 }).catch(() => {});
      break;
    }
    if (!safe()) return unavailable;
  }
  if (!(await signupPage())) return { state: "not_required", filled: [], missing: [] };
  const fields: Array<[string, RegExp, string]> = [
    ["firstName", /first.?name/i, profile.contact.firstName],
    ["lastName", /last.?name/i, profile.contact.lastName],
    ["email", /e.?mail/i, profile.contact.email],
  ];
  const filled: string[] = [];
  const missing: string[] = [];
  for (const [key, label, value] of fields) {
    if (!value?.trim()) continue;
    const field = page.getByLabel(label).first();
    if (!safe()) return unavailable;
    if (await visible(field) && await field.isEnabled().catch(() => false)) {
      await field.fill(value, { timeout: 2000 }).then(() => filled.push(key)).catch(() => missing.push(key));
    } else if (key === "email") missing.push(key);
  }
  if (password) {
    if (password.length < 12 || password.length > 128) throw new Error("Account password must contain 12–128 characters.");
    for (const [key, label] of [
      ["password", /^(?:new )?password\s*\*?$/i],
      ["confirmPassword", /^(?:confirm|repeat|re.?enter|verify)\s*(?:new\s*)?password/i],
    ] as const) {
      const field = page.getByLabel(label).first();
      if (!safe()) return unavailable;
      if (await visible(field) && await field.isEnabled().catch(() => false)) {
        await field.fill(password, { timeout: 2000 }).then(() => filled.push(key)).catch(() => missing.push(key));
      } else missing.push(key);
    }
  }
  // Never click registration submit or consent/terms checkboxes.
  return { state: "manual_required", filled, missing };
}
