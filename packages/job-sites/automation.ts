import { resumeToPlainText } from "../resume/src/resume-schema/markdown.ts";
import {
  helpWorkdaySignIn,
  openWorkdayApplication,
} from "./workday/workday-login.ts";
import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";
import type { CandidateProfile } from "../resume/src/types.ts";
import type { ApplicationQuestion } from "./index.ts";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  adapterForUrl,
  formState,
  discoverQuestions,
  fillQuestionAnswers,
} from "./index.ts";
import {
  fillWorkdayProfile,
  retryWorkdayResumeUpload,
  skipWorkdayLocation,
} from "./workday/autofill.ts";
import {
  prepareEmployerSignUp,
  type AccountSetupResult,
} from "./account-sign-up.ts";

type ResumeAttachment = { fileName: string; buffer: Buffer };
type ApplicationSession = {
  id: string;
  jobId: string;
  profileId: string;
  url: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  directory: string;
  state: string;
  message: string;
  screenshot: string | null;
  filled: string[];
  missing: string[];
  profile: CandidateProfile;
  pendingResume: ResumeAttachment | null;
  resumeFile?: string;
  resumeUploadUrls?: string[];
  ats: string;
  questions: ApplicationQuestion[];
  loginAttempted?: boolean;
  signupPrepared?: AccountSetupResult;
};
type ApplicationPreparation = {
  jobUrl: string;
  jobId: string;
  profileId?: string;
  profile: CandidateProfile;
  resume?: ResumeAttachment;
  launchBrowser?: () => Promise<Browser>;
  accountSetupRequired?: boolean;
  company?: string;
};

const sessions = new Map<string, ApplicationSession>();
const launchingJobs = new Set<string>();
const ALLOWED =
  /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|workday\.com|smartrecruiters\.com)$/i;
const SUCCESS =
  /(?:thank you for (?:your )?appl(?:y|ication)|application (?:has been )?(?:submitted|received)|successfully (?:submitted|applied)|we(?:'ve| have) received your application)/i;

export function validateUrl(input: string) {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    !ALLOWED.test(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error(
      "Apply supports HTTPS Greenhouse, Lever, Ashby, Workday, and SmartRecruiters pages only.",
    );
  return url.toString();
}

export function isSubmissionConfirmed(text: string) {
  return SUCCESS.test(text);
}

async function fill(page: Page, names: RegExp[], value: string) {
  if (!value || !String(value).trim()) return false;
  for (const name of names) {
    for (const locator of [
      page.getByLabel(name, { exact: false }),
      page.getByPlaceholder(name, { exact: false }),
    ]) {
      try {
        const target = locator.first();
        if (
          (await target.isVisible({ timeout: 350 })) &&
          (await target.isEnabled())
        ) {
          if (await target.evaluate((element) => element.tagName === "SELECT"))
            await target.selectOption(
              { label: String(value) },
              { timeout: 2500 },
            );
          else if (
            (await target.getAttribute("role")) === "combobox" ||
            (await target.getAttribute("aria-haspopup")) === "listbox"
          ) {
            await target.click({ timeout: 2500 });
            await target.fill(String(value), { timeout: 1000 }).catch(() => {});
            await page
              .getByRole("option", { name: String(value), exact: true })
              .click({ timeout: 2500 });
          } else await target.fill(String(value), { timeout: 2500 });
          return true;
        }
      } catch {
        /* Unsupported or hidden control: manual review required. */
      }
    }
  }
  return false;
}

export async function fillKnownFields(page: Page, profile: CandidateProfile) {
  const fields: Array<
    [keyof CandidateProfile["contact"] | "fullName", RegExp[]]
  > = [
    ["firstName", [/first.?name/i]],
    ["lastName", [/last.?name/i]],
    ["email", [/e.?mail/i]],
    ["phone", [/^phone number\s*\*?$/i, /^mobile(?: number)?\s*\*?$/i]],
    ["location", [/^location\s*\*?$/i]],
    ["addressLine1", [/^address line 1\s*\*?$/i, /^street address\s*\*?$/i]],
    ["addressLine2", [/^address line 2\s*\*?$/i]],
    ["city", [/^city\s*\*?$/i]],
    ["state", [/^(?:state|province|state or province)\s*\*?$/i]],
    ["postalCode", [/^(?:postal code|zip(?: code)?)\s*\*?$/i]],
    ["country", [/^country\s*\*?$/i]],
    ["phoneCountryCode", [/^country phone code\s*\*?$/i]],
    ["phoneType", [/^phone device type\s*\*?$/i]],
    ["linkedIn", [/linkedin/i]],
    ["github", [/github/i]],
    ["website", [/website|portfolio/i]],
  ];
  const filled: string[] = [];
  const missing: string[] = [];
  const adapter = adapterForUrl(page.url?.() || "");
  const adapterFields: Partial<Record<string, RegExp[]>> =
    adapter?.fields ?? {};
  if (
    adapterFields.fullName &&
    profile.contact.firstName &&
    profile.contact.lastName
  )
    fields.push(["fullName", adapterFields.fullName]);
  for (const [key, locators] of fields) {
    const value =
      key === "fullName"
        ? [profile.contact.firstName, profile.contact.lastName].join(" ")
        : profile.contact[key];
    if (!value) continue;
    if (key === "location" && adapter?.id === "workday" && await skipWorkdayLocation(page))
      continue;
    ((await fill(page, adapterFields[key] || locators, value))
      ? filled
      : missing
    ).push(key);
  }
  return { filled, missing };
}

function status(session: ApplicationSession) {
  return {
    id: session.id,
    jobId: session.jobId,
    profileId: session.profileId,
    state: session.state,
    url: session.url,
    message: session.message,
    screenshot: session.screenshot,
    reviewUrl: process.env.BROWSER_REVIEW_URL || null,
    filled: session.filled,
    missing: session.missing,
    ats: session.ats,
    questions: session.questions || [],
    signupPrepared: session.signupPrepared ?? null,
  };
}

export function getActiveApplication(
  jobId?: string | null,
  profileId = "00000000-0000-4000-8000-000000000001",
) {
  const session = [...sessions.values()].find(
    (item) => item.profileId === profileId && (!jobId || item.jobId === jobId),
  );
  return session ? status(session) : null;
}

async function populateSession(session: ApplicationSession) {
  const page = session.page;
  validateUrl(page.url());
  const results = await fillKnownFields(page, session.profile);
  session.filled = results.filled;
  session.missing = results.missing;
  if (adapterForUrl(page.url())?.id === "workday") {
    const workday = await fillWorkdayProfile(page, session.profile);
    session.filled.push(...workday.filled);
    session.missing.push(...workday.missing);
  } else if (
    Array.isArray(session.profile.experience) &&
    session.profile.experience.length
  ) {
    session.missing.push(
      "work experience (" +
        session.profile.experience.length +
        " entries; review in employer browser)",
    );
  }

  if (session.pendingResume?.buffer?.length) {
    const filename = join(session.directory, session.pendingResume.fileName);
    await writeFile(filename, session.pendingResume.buffer, { mode: 0o600 });
    session.resumeFile = filename;
    try {
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.count()) {
        await fileInput.setInputFiles(filename, { timeout: 3000 });
        session.filled.push("resume");
        session.pendingResume = null;
        session.resumeUploadUrls = [
          ...(session.resumeUploadUrls || []),
          page.url(),
        ];
      } else {
        session.missing.push("resume");
      }
    } catch {
      session.missing.push("resume");
    }
  }

  if (
    !session.pendingResume &&
    session.resumeFile &&
    adapterForUrl(page.url())?.id === "workday"
  ) {
    const upload = await retryWorkdayResumeUpload(
      page,
      session.resumeFile,
      session.resumeUploadUrls || [],
    );
    session.filled.push(...upload.filled);
    session.missing.push(...upload.missing);
    if (upload.uploaded) {
      session.resumeUploadUrls = [
        ...(session.resumeUploadUrls || []),
        page.url(),
      ];
    }
  }
  session.questions = await discoverQuestions(page).catch(() => []);
}

export async function continueApplication(
  id: string,
  profile?: CandidateProfile,
) {
  const session = sessions.get(id);
  if (
    !session ||
    !["manual_intervention", "login_required", "ready_for_review"].includes(
      session.state,
    )
  )
    throw new Error("This session cannot be resumed.");
  if (profile) session.profile = resumeToPlainText(profile);
  if (!adapterForUrl(session.page.url())) {
    session.state = "login_required";
    session.message =
      "Complete login in the browser viewer and return to the employer application before continuing.";
    return status(session);
  }
  if (adapterForUrl(session.page.url())?.id === "workday")
    await helpWorkdaySignIn(session).catch(() => {});
  const text = (
    await session.page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).slice(0, 20000);
  const detected = formState(text, session.page.url());
  if (detected !== "ready_for_review") {
    session.state = detected;
    session.message =
      detected === "login_required"
        ? /wrong email address or password|account (?:may|might) be locked/i.test(
            text,
          )
          ? "Workday did not accept the configured sign-in. Verify your existing account or finish account registration in the employer browser."
          : "Complete employer sign-in, email verification, or SSO in the browser viewer; credentials are never collected by job-application-autofill."
        : "Complete the security challenge manually in the browser viewer.";
    return status(session);
  }
  await populateSession(session);
  session.state = "ready_for_review";
  session.message =
    "Application controls inspected. Review all fields and questions, then explicitly confirm submission.";
  await refreshScreenshot(id);
  return status(session);
}

export async function prepareApplicationAccount(
  id: string,
  company: string,
  password?: string,
) {
  const session = sessions.get(id);
  if (!session) throw new Error("Unknown or expired application session.");
  if (!adapterForUrl(session.page.url()))
    throw new Error("Open the supported employer application first.");
  if (
    password !== undefined &&
    (typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128)
  )
    throw new Error("Account password must contain 12–128 characters.");
  // The destination is compared to the original employer's exact tenant host.
  const result = await prepareEmployerSignUp(
    session.page,
    session.url,
    company,
    session.profile,
    { openRegistration: true, password },
  );
  session.signupPrepared = result;
  if (result.state === "manual_required") {
    session.state = "login_required";
    session.message =
      "Account fields prepared. Review the signup form and finish terms, verification, and submission in the employer browser.";
  } else if (result.state === "unavailable") {
    session.message =
      "Account automation was stopped because the browser is no longer on the employer's application host.";
  } else {
    session.message =
      "No registration form was found. Continue in the employer browser or sign in to an existing account.";
  }
  await refreshScreenshot(id).catch(() => {});
  return status(session);
}

export async function answerApplicationQuestions(
  id: string,
  answers: Record<string, string>,
) {
  const session = sessions.get(id);
  if (!session || session.state !== "ready_for_review")
    throw new Error(
      "Finish sign-in and prepare the application before answering questions.",
    );
  validateUrl(session.page.url());
  session.questions = await discoverQuestions(session.page);
  const result = await fillQuestionAnswers(
    session.page,
    session.questions,
    answers,
  );
  session.questions = await discoverQuestions(session.page);
  session.message = result.unresolved.length
    ? "Some answers need manual attention in the browser viewer."
    : "Supplied answers were filled. Review their exact selections in the browser viewer.";
  await refreshScreenshot(id).catch(() => {});
  return { ...status(session), answerResult: result };
}

export async function prepareApplication({
  jobUrl,
  jobId,
  profileId = "00000000-0000-4000-8000-000000000001",
  profile,
  resume,
  launchBrowser = () =>
    chromium.launch({ headless: process.env.HEADLESS === "true" }),
  accountSetupRequired = false,
  company = "",
}: ApplicationPreparation) {
  const url = validateUrl(jobUrl);
  const adapter = adapterForUrl(url);
  if (typeof jobId !== "string" || !jobId.trim())
    throw new Error("A job identifier is required.");
  const sessionKey = profileId + ":" + jobId;
  if (
    launchingJobs.has(sessionKey) ||
    [...sessions.values()].some(
      (item) => item.profileId === profileId && item.jobId === jobId,
    )
  )
    throw new Error("This application already has an open browser session.");
  launchingJobs.add(sessionKey);
  let browser: Browser | undefined;
  let directory: string | undefined;
  let id: string | undefined;
  try {
    id = randomUUID();
    directory = await mkdtemp(join(tmpdir(), "moya-apply-"));
    browser = await launchBrowser();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: false,
    });
    const page = await context.newPage();
    const session: ApplicationSession = {
      id,
      jobId,
      profileId,
      url,
      browser,
      context,
      page,
      directory,
      state: "preparing",
      message: "",
      screenshot: null,
      filled: [],
      missing: [],
      profile: resumeToPlainText(profile),
      pendingResume: resume ?? null,
      ats: adapter?.id || "unknown",
      questions: [],
    };
    sessions.set(id, session);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    // Account sign-in/SSO may redirect to an identity provider. Do not
    // autofill anything outside the supported ATS domain.
    await page.waitForTimeout(1000);
    if (!adapterForUrl(page.url())) {
      session.state = "login_required";
      session.message =
        "Sign in manually in the viewer and return to the supported employer application; never provide passwords to the dashboard.";
      return status(session);
    }
    if (adapter?.id === "workday") {
      await openWorkdayApplication(page).catch(() => {});
      await helpWorkdaySignIn(session).catch(() => {});
    }
    if (accountSetupRequired && company) {
      session.signupPrepared = await prepareEmployerSignUp(
        page,
        url,
        company,
        profile,
        { openRegistration: false },
      ).catch(() => ({
        state: "not_required" as const,
        filled: [],
        missing: [],
      }));
    }
    const text = (
      await page
        .locator("body")
        .innerText()
        .catch(() => "")
    ).slice(0, 20000);
    const state = formState(text, page.url());
    if (state !== "ready_for_review") {
      session.state = state;
      session.message =
        state === "login_required"
          ? session.signupPrepared?.state === "manual_required"
            ? "Account signup fields prepared. Finish password, legal terms and verification in the employer browser."
            : "Complete employer account sign-in or verification manually in the interactive browser viewer."
          : "Complete the security challenge manually in the interactive browser viewer.";
      return status(session);
    }

    await populateSession(session);
    session.state = "ready_for_review";
    session.message =
      "Fields prepared. Inspect the real employer form, complete missing questions and verify the destination before submitting.";
    await mkdir(resolve("screenshots"), { recursive: true });
    await refreshScreenshot(id);
    return status(session);
  } catch (error) {
    if (id && sessions.has(id)) await closeApplication(id);
    else {
      if (browser) await browser.close().catch(() => {});
      if (directory)
        await rm(directory, { recursive: true, force: true }).catch(() => {});
    }
    throw error;
  } finally {
    launchingJobs.delete(sessionKey);
  }
}

export function getApplication(id: string) {
  const session = sessions.get(id);
  if (!session) throw new Error("Unknown or expired application session.");
  return status(session);
}

/** User-triggered clipboard insertion; text is neither persisted nor included in status. */
export async function pasteApplicationText(id: string, text: unknown) {
  const session = sessions.get(id);
  if (!session) throw new Error("Unknown or expired application session.");
  if (typeof text !== "string" || text.length > 100000)
    throw new Error("Invalid clipboard text.");
  if (
    !adapterForUrl(session.page.url()) ||
    new URL(session.page.url()).hostname !== new URL(session.url).hostname
  )
    throw new Error("Return to the employer application before pasting.");
  await session.page.bringToFront();
  const editable = await session.page.evaluate(() => {
    const field = document.activeElement;
    if (!(field instanceof HTMLElement)) return false;
    if (field.isContentEditable) return true;
    if (field instanceof HTMLTextAreaElement)
      return !field.disabled && !field.readOnly;
    if (field instanceof HTMLInputElement)
      return (
        !field.disabled &&
        !field.readOnly &&
        [
          "text",
          "email",
          "password",
          "search",
          "tel",
          "url",
          "number",
        ].includes(field.type)
      );
    return false;
  });
  if (!editable)
    throw new Error(
      "Select an editable field in the employer page, then paste again.",
    );
  await session.page.keyboard.insertText(text);
  return { pasted: true };
}

export async function refreshScreenshot(
  id: string,
  { focus = false }: { focus?: boolean } = {},
) {
  const session = sessions.get(id);
  if (!session) throw new Error("Unknown or expired application session.");
  if (focus) await session.page.bringToFront();
  const path = resolve("screenshots", id + ".png");
  await mkdir(resolve("screenshots"), { recursive: true });
  await session.page.screenshot({ path, fullPage: false });
  session.screenshot = "/api/apply/" + id + "/screenshot";
  return status(session);
}

export async function submitApplication(id: string) {
  if (
    process.env.CONTAINER_MODE === "true" &&
    (!process.env.BROWSER_REVIEW_URL || process.env.HEADLESS === "true")
  )
    throw new Error("Final submission requires an interactive browser viewer.");
  const session = sessions.get(id);
  if (!session || session.state !== "ready_for_review")
    throw new Error("Application is not ready for submission.");
  const page = session.page;
  const pageText = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).slice(0, 16000);
  if (formState(pageText, page.url()) !== "ready_for_review")
    throw new Error("Sign-in or security verification is still pending.");
  // VNC allows manual navigation. Never click Submit on an unrelated page.
  validateUrl(page.url());
  const button = page
    .getByRole("button", {
      name: /^(submit application|submit|send application|apply)$/i,
    })
    .first();
  if (!(await button.isVisible()) || !(await button.isEnabled()))
    throw new Error(
      "No enabled final submission button found. Complete site-specific questions manually.",
    );
  await button.click({ timeout: 5000 });
  await page
    .waitForLoadState("domcontentloaded", { timeout: 7000 })
    .catch(() => {});
  const text = (
    await page
      .locator("body")
      .innerText({ timeout: 5000 })
      .catch(() => "")
  ).slice(0, 12000);
  session.state = isSubmissionConfirmed(text)
    ? "submitted"
    : "submission_unverified";
  session.message =
    session.state === "submitted"
      ? "The employer page displays an application confirmation. Verify any follow-up steps."
      : "Submit was clicked but no employer confirmation was detected. Check the employer website; do not assume submission succeeded or retry blindly.";
  await refreshScreenshot(id).catch(() => {});
  return status(session);
}

export async function closeApplication(id: string) {
  const session = sessions.get(id);
  if (!session) return;
  sessions.delete(id);
  await session.browser.close().catch(() => {});
  await rm(session.directory, { recursive: true, force: true }).catch(() => {});
  await rm(resolve("screenshots", id + ".png"), { force: true }).catch(
    () => {},
  );
}
