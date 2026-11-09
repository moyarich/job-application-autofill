import { resumeToPlainText } from "../resume/src/resume-schema/markdown.ts";
import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";
import type { CandidateProfile } from "../resume/src/types.ts";
import type { ApplicationQuestion } from "./index.ts";
import { workdayCredentials } from "./workday/workday-login.ts";
import { prepareRegistration } from "./handlers/registration.ts";
import { prepareSignIn } from "./handlers/sign-in.ts";
import { automateCurrentStep, listJobSiteMenu, executeJobSiteMenuItem } from "./core/orchestrator.ts";
import { detectCurrentPage } from "./core/state-machine.ts";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  adapterForUrl,
  formState,
} from "./index.ts";
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
  accountAction?: "signup" | "login";
  company?: string;
};

const sessions = new Map<string, ApplicationSession>();
const launchingJobs = new Set<string>();

const SUCCESS =
  /(?:thank you for (?:your )?appl(?:y|ication)|application (?:has been )?(?:submitted|received)|successfully (?:submitted|applied)|we(?:'ve| have) received your application)/i;

export function validateUrl(input: string) {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    !adapterForUrl(url.toString()) ||
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
  const adapter = adapterForUrl(session.page.url());
  if (!adapter) throw new Error("Return to the supported employer application.");
  const outcome = await automateCurrentStep({
    page: session.page,
    profile: session.profile,
    expectedHost: new URL(session.url).hostname,
    directory: session.directory,
    pendingResume: session.pendingResume,
    resumeFile: session.resumeFile,
    resumeUploadUrls: session.resumeUploadUrls,
  }, adapter);
  if (outcome.detection.kind !== "application") {
    throw new Error("The employer application is not ready for autofill.");
  }
  session.filled = outcome.filled;
  session.missing = outcome.missing;
  session.pendingResume = outcome.pendingResume;
  session.resumeFile = outcome.resumeFile;
  session.resumeUploadUrls = outcome.resumeUploadUrls;
  session.questions = outcome.questions;
}

/** Only actions explicitly declared by the current site's adapter are visible. */
export async function getApplicationMenu(id: string) {
  const session = sessions.get(id);
  if (!session) throw new Error("Unknown or expired application session.");
  const adapter = adapterForUrl(session.page.url());
  if (!adapter) return [];
  return listJobSiteMenu({
    page: session.page, profile: session.profile,
    expectedHost: new URL(session.url).hostname,
    directory: session.directory, pendingResume: session.pendingResume,
    resumeFile: session.resumeFile, resumeUploadUrls: session.resumeUploadUrls,
  }, adapter);
}

/** A menu click invokes exactly one site-owned step; it never submits. */
export async function runApplicationMenuItem(id: string, itemId: string) {
  const session = sessions.get(id);
  if (!session || !["ready_for_review", "login_required", "manual_intervention"].includes(session.state))
    throw new Error("Application session is not ready for this action.");
  const adapter = adapterForUrl(session.page.url());
  if (!adapter) throw new Error("Return to the employer application first.");
  const outcome = await executeJobSiteMenuItem({
    page: session.page, profile: session.profile,
    expectedHost: new URL(session.url).hostname,
    directory: session.directory, pendingResume: session.pendingResume,
    resumeFile: session.resumeFile, resumeUploadUrls: session.resumeUploadUrls,
  }, adapter, itemId);
  session.filled = [...new Set([...session.filled, ...outcome.filled])];
  session.missing = [...new Set([...session.missing, ...outcome.missing])];
  session.questions = outcome.questions.length ? outcome.questions : session.questions;
  session.pendingResume = outcome.pendingResume;
  session.resumeFile = outcome.resumeFile;
  session.resumeUploadUrls = outcome.resumeUploadUrls;
  session.state = "ready_for_review";
  session.message = "Selected employer step processed. Review the fields before submitting.";
  return status(session);
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
  const adapter = adapterForUrl(session.page.url());
  if (adapter) await prepareSignIn(adapter, session).catch(() => {});
  const text = (
    await session.page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).slice(0, 20000);
  const pageDetection = adapter ? await detectCurrentPage(session.page, adapter, new URL(session.url).hostname) : null;
  const detected = pageDetection?.kind === "challenge" ? "manual_intervention" : pageDetection?.kind === "external" || pageDetection?.kind === "registration" || pageDetection?.kind === "sign_in" ? "login_required" : formState(text, session.page.url());
  if (detected !== "ready_for_review") {
    session.state = detected;
    const providerError = adapter?.loginFailureMessage?.(text);
    session.message =
      detected === "login_required"
        ? providerError ??
          "Complete employer sign-in, email verification, or SSO in the browser viewer; credentials are never collected by job-application-autofill."
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
  const result = await prepareRegistration(
    session.page,
    session.url,
    company,
    session.profile,
    { openRegistration: true, password, submitConfigured: true },
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
  const adapter = adapterForUrl(session.page.url());
  if (!adapter?.answerQuestions || !adapter.discoverQuestions) {
    throw new Error("This job site has no configured screening-answer handler.");
  }
  const result = await adapter.answerQuestions(session.page, answers);
  session.questions = await adapter.discoverQuestions(session.page);
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
  accountAction,
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
    if (adapter?.openApplication)
      await adapter.openApplication(page).catch(() => {});
    if (accountAction !== "signup" && adapter?.helpSignIn)
      await prepareSignIn(adapter, session).catch(() => {});
    if ((accountAction === "signup" || (!accountAction && accountSetupRequired)) && company) {
      session.signupPrepared = await prepareEmployerSignUp(
        page,
        url,
        company,
        profile,
        {
          openRegistration: accountAction === "signup" || Boolean(workdayCredentials(page.url())) && formState(await page.locator("body").innerText().catch(() => ""), page.url()) === "login_required",
          submitConfigured: true,
        },
      ).catch(() => ({
        state: "not_required" as const,
        filled: [],
        missing: [],
      }));
    }
    if (session.signupPrepared?.submitted && adapter?.helpSignIn) {
      await prepareSignIn(adapter, session).catch(() => {});
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
            ? session.signupPrepared.credentialSource === "none"
              ? "Email filled. No usable configured password was available for this employer."
              : "Account details filled. Complete any verification shown in the employer browser."
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
