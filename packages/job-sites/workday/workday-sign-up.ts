import type { Page } from "playwright";

export interface WorkdaySignUpResult {
  state: "unavailable" | "not_sign_up" | "manual_required";
  emailFilled: boolean;
}

/** Prepare account creation without setting passwords, accepting terms, or submitting. */
export async function helpWorkdaySignUp(
  page: Page,
  env: NodeJS.ProcessEnv = process.env,
  { openCreateAccount = false }: { openCreateAccount?: boolean } = {},
): Promise<WorkdaySignUpResult> {
  const emailAddress =
    env.WORKDAY_USERNAME || env.WORKDAY_USER_EMAIL || env.RESUME_SITE_EMAIL;
  const allowed = () => {
    const url = new URL(page.url());
    const host = (
        env.WORKDAY_HOST ||
      "workday.wd5.myworkdayjobs.com"
    )
      .trim()
      .toLowerCase();
    return (
      url.protocol === "https:" &&
      url.hostname === host &&
      host.endsWith(".myworkdayjobs.com") &&
      !url.username &&
      !url.password
    );
  };
  if (!emailAddress || !allowed())
    return { state: "unavailable", emailFilled: false };
  const heading = page
    .getByRole("heading", { name: /^create (?:an? )?account$/i })
    .first();
  if (!(await heading.isVisible().catch(() => false)) && openCreateAccount) {
    const link = page.getByRole("link", { name: /^create account$/i }).first();
    const button = page
      .getByRole("button", { name: /^create account$/i })
      .first();
    if (await link.isVisible().catch(() => false)) await link.click();
    else if (await button.isVisible().catch(() => false)) await button.click();
    await heading.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  }
  if (!allowed()) return { state: "unavailable", emailFilled: false };
  if (!(await heading.isVisible().catch(() => false)))
    return { state: "not_sign_up", emailFilled: false };
  const email = page.getByLabel(/email(?: address)?/i).first();
  let emailFilled = false;
  if (emailAddress && (await email.isVisible().catch(() => false))) {
    await email.fill(emailAddress);
    emailFilled = true;
  }
  return { state: "manual_required", emailFilled };
}
