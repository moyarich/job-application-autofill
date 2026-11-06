import type { Page, Locator } from "playwright";
import { helpWorkdaySignUp } from "./workday-sign-up.ts";
// Credentials are scoped to one employer tenant and never returned to the dashboard.
export function workdayCredentials(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const destination = new URL(url);
  const host = (
    env.WORKDAY_HOST ||
    env.RESUME_SITE_HOST ||
    "workday.wd5.myworkdayjobs.com"
  )
    .trim()
    .toLowerCase();
  if (
    destination.protocol !== "https:" ||
    destination.hostname !== host ||
    !host.endsWith(".myworkdayjobs.com") ||
    destination.username ||
    destination.password
  )
    return null;
  const email =
    env.WORKDAY_USERNAME || env.WORKDAY_USER_EMAIL || env.RESUME_SITE_EMAIL;
  const password = env.WORKDAY_PASSWORD || env.RESUME_SITE_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export async function openWorkdayApplication(page: Page) {
  if (!new URL(page.url()).hostname.endsWith(".myworkdayjobs.com")) return;
  const apply = page
    .getByRole("button", { name: "Apply", exact: true })
    .first();
  await apply.waitFor({ state: "visible", timeout: 12000 }).catch(() => {});
  if (!(await apply.isVisible().catch(() => false))) return;
  await apply.click();
  const autofill = page
    .getByRole("button", { name: "Autofill with Resume", exact: true })
    .first();
  await autofill.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await autofill.isVisible().catch(() => false)) {
    await autofill.click();
    await page
      .getByRole("button", { name: "Sign in with email", exact: true })
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() => {});
  }
}

export async function helpWorkdaySignIn(
  session: { page: Page; loginAttempted?: boolean },
  env: NodeJS.ProcessEnv = process.env,
) {
  if (session.loginAttempted) return;
  const page = session.page;
  if (
    workdayCredentials(page.url(), env) &&
    (await page
      .getByRole("heading", { name: /^create (?:an? )?account$/i })
      .first()
      .isVisible()
      .catch(() => false))
  ) {
    const existing = page.getByRole("link", { name: /^sign in$/i }).first();
    if (await existing.isVisible().catch(() => false)) {
      await existing.click();
      await page
        .getByRole("heading", { name: /^sign in$/i })
        .first()
        .waitFor({ state: "visible", timeout: 5000 })
        .catch(() => {});
    }
  }
  if ((await helpWorkdaySignUp(page, env)).state === "manual_required") return;
  if (session.loginAttempted || !workdayCredentials(page.url(), env)) return;
  const visible = async (locator: Locator) =>
    await locator.isVisible().catch(() => false);
  // Enter the application flow without creating an account or accepting terms.
  const apply = page
    .getByRole("button", { name: "Apply", exact: true })
    .first();
  if (await visible(apply)) {
    await apply.click();
    const autofill = page
      .getByRole("button", { name: "Autofill with Resume", exact: true })
      .first();
    if (await visible(autofill)) await autofill.click();
  }
  const emailSignIn = page
    .getByRole("button", { name: "Sign in with email", exact: true })
    .last();
  await emailSignIn
    .waitFor({ state: "visible", timeout: 5000 })
    .catch(() => {});
  if (await visible(emailSignIn)) await emailSignIn.click();
  const email = page.getByLabel(/email(?: address)?/i).last();
  const password = page.getByLabel(/^password\s*\*?$/i).last();
  await password.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  const credentials = workdayCredentials(page.url(), env);
  const text = await page.locator("body").innerText();
  if (
    await visible(
      page.getByRole("heading", { name: /^create (?:an? )?account$/i }).first(),
    )
  ) {
    if (credentials && (await visible(email)))
      await email.fill(credentials.email);
    return; // New passwords, terms and account creation remain in the user's control.
  }
  if (
    !credentials ||
    /captcha|verify you are human|verification code|confirm password/i.test(
      text,
    )
  )
    return;
  let submit = page.getByRole("button", { name: /^sign in$/i }).last();
  // Workday also has a global Sign In button. Prefer the actual form submit.
  if (typeof password.locator === "function") {
    const form = password.locator("xpath=ancestor::form[1]");
    const workdaySubmit = page
      .locator('[data-automation-id="signInSubmitButton"]')
      .last();
    if (await visible(workdaySubmit)) submit = workdaySubmit;
    else if (await form.count())
      submit = form.getByRole("button", { name: /^sign in$/i }).first();
    else submit = page.getByRole("button", { name: /^sign in$/i }).last();
  }
  if (
    !(await visible(email)) ||
    !(await visible(password)) ||
    !(await visible(submit))
  )
    return;
  session.loginAttempted = true;
  await email.fill(credentials.email);
  await password.fill(credentials.password);
  // Recheck the tenant immediately before submitting existing-account credentials.
  if (!workdayCredentials(page.url(), env)) return;
  await submit.click();
  await password.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
}
