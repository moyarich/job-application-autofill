import { chromium } from "playwright";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { adapterForUrl, formState, discoverQuestions, fillQuestionAnswers } from "../playwright-adapters/index.mjs";

const sessions = new Map();
let launching = false;
const ALLOWED = /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|workday\.com|smartrecruiters\.com)$/i;
const SUCCESS = /(?:thank you for (?:your )?appl(?:y|ication)|application (?:has been )?(?:submitted|received)|successfully (?:submitted|applied)|we(?:'ve| have) received your application)/i;

export function validateUrl(input) {
  const url = new URL(input);
  if (url.protocol !== "https:" || !ALLOWED.test(url.hostname) || url.username || url.password)
    throw new Error("Apply supports HTTPS Greenhouse, Lever, Ashby, Workday, and SmartRecruiters pages only.");
  return url.toString();
}

export function isSubmissionConfirmed(text) {
  return SUCCESS.test(text);
}

async function fill(page, names, value) {
  if (!value || !String(value).trim()) return false;
  for (const name of names) {
    for (const locator of [page.getByLabel(name, { exact: false }), page.getByPlaceholder(name, { exact: false })]) {
      try {
        const target = locator.first();
        if (await target.isVisible({ timeout: 350 }) && await target.isEnabled()) {
          await target.fill(String(value), { timeout: 2500 });
          return true;
        }
      } catch { /* Unsupported or hidden control: manual review required. */ }
    }
  }
  return false;
}

export async function fillKnownFields(page, profile) {
  const fields = [
    ["firstName", [/first.?name/i]],
    ["lastName", [/last.?name/i]],
    ["email", [/e.?mail/i]],
    ["phone", [/phone|mobile/i]],
    ["location", [/location|city/i]],
    ["linkedIn", [/linkedin/i]],
    ["github", [/github/i]],
    ["website", [/website|portfolio/i]],
  ];
  const filled = [];
  const missing = [];
  const adapter = adapterForUrl(page.url?.() || "");
  if (adapter?.fields?.fullName && profile.contact.firstName && profile.contact.lastName)
    fields.push(["fullName", adapter.fields.fullName]);
  for (const [key, locators] of fields) {
    const value = key === "fullName" ? [profile.contact.firstName, profile.contact.lastName].join(" ") : profile.contact[key];
    if (!value) continue;
    (await fill(page, adapter?.fields?.[key] || locators, value) ? filled : missing).push(key);
  }
  return { filled, missing };
}

function status(session) {
  return {
    id: session.id,
    jobId: session.jobId,
    state: session.state,
    url: session.url,
    message: session.message,
    screenshot: session.screenshot,
    reviewUrl: process.env.BROWSER_REVIEW_URL || null,
    filled: session.filled,
    missing: session.missing,
    ats: session.ats,
    questions: session.questions || [],
  };
}

export function getActiveApplication() {
  const session = sessions.values().next().value;
  return session ? status(session) : null;
}

async function populateSession(session) {
  const page = session.page;
  validateUrl(page.url());
    const results = await fillKnownFields(page, session.profile);
    session.filled = results.filled;
    session.missing = results.missing;
    // Structured work history is passed to the session, but repeating ATS
    // employment forms are not safely autofilled without site-specific mapping.
    if (Array.isArray(session.profile.experience) && session.profile.experience.length)
      session.missing.push("work experience (" + session.profile.experience.length + " entries; review in employer browser)");

    if (session.pendingResume?.buffer?.length) {
      const filename = join(session.directory, session.pendingResume.fileName);
      await writeFile(filename, session.pendingResume.buffer, { mode: 0o600 });
      try {
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.count()) {
          await fileInput.setInputFiles(filename, { timeout: 3000 });
          session.filled.push("resume");
        } else {
          session.missing.push("resume");
        }
      } catch {
        session.missing.push("resume");
      }
    }

  session.pendingResume = null;
  session.questions = await discoverQuestions(page).catch(() => []);
}

export async function continueApplication(id) {
  const session = sessions.get(id);
  if (!session || !["manual_intervention", "login_required", "ready_for_review"].includes(session.state))
    throw new Error("This session cannot be resumed.");
  if (!adapterForUrl(session.page.url())) {
    session.state = "login_required";
    session.message = "Complete login in the browser viewer and return to the employer application before continuing.";
    return status(session);
  }
  const text = (await session.page.locator("body").innerText().catch(() => "")).slice(0, 20000);
  const detected = formState(text, session.page.url());
  if (detected !== "ready_for_review") {
    session.state = detected;
    session.message = detected === "login_required"
      ? "Complete employer sign-in, email verification, or SSO in the browser viewer; credentials are never collected by MoyaApply."
      : "Complete the security challenge manually in the browser viewer.";
    return status(session);
  }
  await populateSession(session);
  session.state = "ready_for_review";
  session.message = "Application controls inspected. Review all fields and questions, then explicitly confirm submission.";
  await refreshScreenshot(id);
  return status(session);
}

export async function answerApplicationQuestions(id, answers) {
  const session = sessions.get(id);
  if (!session || session.state !== "ready_for_review")
    throw new Error("Finish sign-in and prepare the application before answering questions.");
  validateUrl(session.page.url());
  session.questions = await discoverQuestions(session.page);
  const result = await fillQuestionAnswers(session.page, session.questions, answers);
  session.questions = await discoverQuestions(session.page);
  session.message = result.unresolved.length
    ? "Some answers need manual attention in the browser viewer."
    : "Supplied answers were filled. Review their exact selections in the browser viewer.";
  await refreshScreenshot(id).catch(() => {});
  return { ...status(session), answerResult: result };
}

export async function prepareApplication({ jobUrl, jobId, profile, resume }) {
  const url = validateUrl(jobUrl);
  const adapter = adapterForUrl(url);
  if (typeof jobId !== "string" || !jobId.trim()) throw new Error("A job identifier is required.");
  if (launching || sessions.size > 0) throw new Error("Close the existing application browser session before starting another.");
  launching = true;
  let browser;
  let directory;
  let id;
  try {
    id = randomUUID();
    directory = await mkdtemp(join(tmpdir(), "moya-apply-"));
    browser = await chromium.launch({ headless: process.env.HEADLESS === "true" });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: false });
    const page = await context.newPage();
    const session = {
      id, jobId, url, browser, context, page, directory, state: "preparing",
      message: "", screenshot: null, filled: [], missing: [], profile, pendingResume: resume,
      ats: adapter?.id || "unknown", questions: [],
    };
    sessions.set(id, session);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    // Account sign-in/SSO may redirect to an identity provider. Do not
    // autofill anything outside the supported ATS domain.
    await page.waitForTimeout(1000);
    if (!adapterForUrl(page.url())) {
      session.state = "login_required";
      session.message = "Sign in manually in the viewer and return to the supported employer application; never provide passwords to the dashboard.";
      return status(session);
    }
    const text = (await page.locator("body").innerText().catch(() => "")).slice(0, 20000);
    const state = formState(text, page.url());
    if (state !== "ready_for_review") {
      session.state = state;
      session.message = state === "login_required"
        ? "Complete employer account sign-in or verification manually in the interactive browser viewer."
        : "Complete the security challenge manually in the interactive browser viewer.";
      return status(session);
    }

    await populateSession(session);
    session.state = "ready_for_review";
    session.message = "Fields prepared. Inspect the real employer form, complete missing questions and verify the destination before submitting.";
    await mkdir(resolve("screenshots"), { recursive: true });
    await refreshScreenshot(id);
    return status(session);
  } catch (error) {
    if (id && sessions.has(id)) await closeApplication(id);
    else {
      if (browser) await browser.close().catch(() => {});
      if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
    }
    throw error;
  } finally {
    launching = false;
  }
}

export function getApplication(id) {
  const session = sessions.get(id);
  if (!session) throw new Error("Unknown or expired application session.");
  return status(session);
}

export async function refreshScreenshot(id) {
  const session = sessions.get(id);
  if (!session) throw new Error("Unknown or expired application session.");
  const path = resolve("screenshots", id + ".png");
  await mkdir(resolve("screenshots"), { recursive: true });
  await session.page.screenshot({ path, fullPage: false });
  session.screenshot = "/api/apply/" + id + "/screenshot";
  return status(session);
}

export async function submitApplication(id) {
  if (process.env.CONTAINER_MODE === "true" && (!process.env.BROWSER_REVIEW_URL || process.env.HEADLESS === "true"))
    throw new Error("Final submission requires an interactive browser viewer.");
  const session = sessions.get(id);
  if (!session || session.state !== "ready_for_review")
    throw new Error("Application is not ready for submission.");
  const page = session.page;
  const pageText = (await page.locator("body").innerText().catch(() => "")).slice(0, 16000);
  if (formState(pageText, page.url()) !== "ready_for_review")
    throw new Error("Sign-in or security verification is still pending.");
  // VNC allows manual navigation. Never click Submit on an unrelated page.
  validateUrl(page.url());
  const button = page.getByRole("button", { name: /^(submit application|submit|send application|apply)$/i }).first();
  if (!(await button.isVisible()) || !(await button.isEnabled()))
    throw new Error("No enabled final submission button found. Complete site-specific questions manually.");
  await button.click({ timeout: 5000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 7000 }).catch(() => {});
  const text = (await page.locator("body").innerText({ timeout: 5000 }).catch(() => "")).slice(0, 12000);
  session.state = isSubmissionConfirmed(text) ? "submitted" : "submission_unverified";
  session.message = session.state === "submitted"
    ? "The employer page displays an application confirmation. Verify any follow-up steps."
    : "Submit was clicked but no employer confirmation was detected. Check the employer website; do not assume submission succeeded or retry blindly.";
  await refreshScreenshot(id).catch(() => {});
  return status(session);
}

export async function closeApplication(id) {
  const session = sessions.get(id);
  if (!session) return;
  sessions.delete(id);
  await session.browser.close().catch(() => {});
  await rm(session.directory, { recursive: true, force: true }).catch(() => {});
  await rm(resolve("screenshots", id + ".png"), { force: true }).catch(() => {});
}
