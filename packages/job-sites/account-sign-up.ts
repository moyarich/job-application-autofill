import type { Page, Locator } from "playwright";
import type { CandidateProfile } from "../resume/src/types.ts";
import { workdayCredentials } from "./workday/workday-login.ts";
import { employerAccountIdentity } from "./employer-account.ts";

export type AccountSetupResult = {
  state: "unavailable" | "not_required" | "prepared" | "manual_required";
  filled: string[];
  missing: string[];
  submitted?: boolean;
  credentialSource?: "configured" | "provided" | "none";
};

/**
 * Fill employer registration from tenant-scoped credentials. Submit only when
 * the caller requests configured signup; leave consent and challenges untouched.
 * Passwords never appear in returned state or persistent application records.
 */
export async function prepareEmployerSignUp(
  page: Page,
  jobUrl: string,
  company: string,
  profile: CandidateProfile,
  { openRegistration = true, password, submitConfigured = false }: { openRegistration?: boolean; password?: string; submitConfigured?: boolean } = {},
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
  const configured = identity.provider === "workday" ? workdayCredentials(page.url(), process.env, { employerHost: identity.host }) : null;
  const signupPassword = password ?? configured?.password;
  const credentialSource = password ? "provided" as const : configured ? "configured" as const : "none" as const;
  const visible = async (locator: Locator) => locator.isVisible({ timeout: 500 }).catch(() => false);
  const signupPage = async () => {
    if (!safe()) return false;
    const url = new URL(page.url());
    const heading = page.getByRole("heading", { name: /^(?:create (?:an? |your )?account|sign up|register(?: an account)?)$/i }).first();
    return /(?:create[ -]?account|sign[ -]?up|register|registration)/i.test(url.pathname) ||
      await visible(heading);
  };
  if (openRegistration && identity.provider === "workday" && !(await signupPage())) {
    const emailGateway = page.getByRole("button", { name: "Sign in with email", exact: true }).last();
    if (await visible(emailGateway)) {
      await emailGateway.click({ timeout: 5000 });
      await page.getByRole("link", { name: /^create (?:an? )?account$/i }).first()
        .waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
      if (!safe()) return unavailable;
    }
  }
  if (openRegistration && !(await signupPage())) {
    const choices = [
      page.getByRole("link", { name: /^(?:create (?:an? |your )?account|sign up|register)$/i }).first(),
      page.getByRole("button", { name: /^(?:create (?:an? |your )?account|sign up|register)$/i }).first(),
    ];
    for (const link of choices) {
      if (!(await visible(link))) continue;
      await link.click({ timeout: 2500 }).catch(() => {});
      await page.getByRole("heading", { name: /^(?:create (?:an? |your )?account|sign up|register(?: an account)?)$/i }).first()
        .waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
      break;
    }
    if (!safe()) return unavailable;
  }
  if (!(await signupPage())) return { state: "not_required", filled: [], missing: [] };
  const fields: Array<[string, RegExp, string]> = [
    ["firstName", /first.?name/i, profile.contact.firstName],
    ["lastName", /last.?name/i, profile.contact.lastName],
    ["email", /e.?mail/i, configured?.email ?? profile.contact.email],
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
  if (signupPassword) {
    if (password && (password.length < 12 || password.length > 128)) throw new Error("Account password must contain 12–128 characters.");
    for (const [key, label] of [
      ["password", /^(?:new )?password\s*\*?$/i],
      ["confirmPassword", /^(?:confirm|repeat|re.?enter|verify)\s*(?:new\s*)?password/i],
    ] as const) {
      const field = page.getByLabel(label).first();
      if (!safe()) return unavailable;
      if (await visible(field) && await field.isEnabled().catch(() => false)) {
        await field.fill(signupPassword, { timeout: 2000 }).then(() => filled.push(key)).catch(() => missing.push(key));
      } else missing.push(key);
    }
  }
  // Automatic signup is explicit and limited to this tenant's configured account.
  // Account creation acknowledgement follows the requested signup action; unrelated consent and challenges remain manual.
  if (submitConfigured && configured && !password && safe() &&
      filled.includes("password") && filled.includes("confirmPassword") && !missing.length) {
    const createAccountConsent = page.getByRole("checkbox", { name: /^I agree to creating this account to allow me to apply for positions with /i }).first();
    if (safe() && await visible(createAccountConsent) && await createAccountConsent.isEnabled().catch(() => false)) {
      await createAccountConsent.check({ timeout: 3000 });
    }
    const consent = page.locator('input[type="checkbox"][required], [role="checkbox"][aria-required="true"]').first();
    const blocked = await visible(consent) && !(await consent.isChecked().catch(() => false));
    const challenge = page.locator('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], [data-testid="captcha"]').first();
    if (blocked) missing.push("required consent");
    else if (!(await visible(challenge))) {
      const submit = page.getByRole("button", { name: /^(?:create (?:an? |your )?account|sign up|register)$/i }).last();
      if (safe() && await visible(submit) && await submit.isEnabled().catch(() => false)) {
        await submit.click({ timeout: 5000 });
        await page.getByRole("heading", { name: /^(?:create (?:an? |your )?account|sign up|register(?: an account)?)$/i }).first()
          .waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
        return { state: "manual_required", filled, missing, credentialSource, submitted: true };
      }
    }
  }
  return { state: "manual_required", filled, missing, credentialSource };
}
