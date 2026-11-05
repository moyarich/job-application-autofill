import { chromium } from "playwright";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const sessions = new Map();
const ALLOWED = /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|workday\.com|smartrecruiters\.com)$/i;
function validateUrl(input) {
  const url = new URL(input);
  if (url.protocol !== "https:" || !ALLOWED.test(url.hostname) || url.username || url.password)
    throw new Error("Apply supports HTTPS Greenhouse, Lever, Ashby, Workday, and SmartRecruiters pages only.");
  return url.toString();
}
async function fill(page, labels, value) {
  if (!value) return false;
  for (const label of labels) {
    const locators = [page.getByLabel(label, { exact: false }), page.getByPlaceholder(label, { exact: false })];
    for (const locator of locators) {
      try {
        const first = locator.first();
        if (await first.isVisible({ timeout: 600 })) { await first.fill(String(value), { timeout: 3000 }); return true; }
      } catch { /* Unsupported control; continue */ }
    }
  }
  return false;
}
function status(session) {
  return { id: session.id, state: session.state, url: session.url, message: session.message, screenshot: session.screenshot,
    reviewUrl: process.env.BROWSER_REVIEW_URL || null };
}
export async function prepareApplication({ jobUrl, profile, resume }) {
  const url = validateUrl(jobUrl);
  const id = randomUUID(), directory = await mkdtemp(join(tmpdir(), "moya-apply-"));
  const browser = await chromium.launch({ headless: process.env.HEADLESS === "true" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: false });
  const page = await context.newPage();
  const session = { id, url, browser, context, page, directory, state: "preparing", message: "", screenshot: null };
  sessions.set(id, session);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1200);
    const text = (await page.locator("body").innerText().catch(() => "")).slice(0, 20000);
    if (/captcha|verify you are human|security challenge|cloudflare check/i.test(text)) {
      session.state = "manual_intervention"; session.message = "Security challenge detected. Complete it manually in the browser."; return status(session);
    }
    await fill(page, [/first.?name/i], profile.firstName);
    await fill(page, [/last.?name/i], profile.lastName);
    await fill(page, [/e.?mail/i], profile.email);
    await fill(page, [/phone|mobile/i], profile.phone);
    await fill(page, [/location|city/i], profile.location);
    await fill(page, [/linkedin/i], profile.linkedIn);
    await fill(page, [/github/i], profile.github);
    await fill(page, [/website|portfolio/i], profile.website);
    if (resume?.buffer?.length) {
      const filename = join(directory, resume.fileName);
      await writeFile(filename, resume.buffer, { mode: 0o600 });
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.count()) {
        await fileInput.setInputFiles(filename).catch(() => {});
      }
    }
    // Never click Continue/Submit automatically: user must inspect site-specific questions.
    session.state = "ready_for_review";
    session.message = process.env.BROWSER_REVIEW_URL
      ? "Known fields filled. Open the password-protected browser viewer to inspect and edit the application before confirming submission."
      : "Known fields filled. Review required questions in the opened browser; submission requires explicit confirmation.";
    const screenshots = resolve("screenshots");
    await mkdir(screenshots, { recursive: true });
    const destination = join(screenshots, id + ".png");
    await page.screenshot({ path: destination, fullPage: false }).catch(() => {});
    session.screenshot = "/api/apply/" + id + "/screenshot";
    return status(session);
  } catch (error) {
    await closeApplication(id);
    throw error;
  }
}
export function getApplication(id) {
  const session = sessions.get(id);
  if (!session) throw new Error("Unknown or expired application session.");
  return status(session);
}
export async function submitApplication(id) {
  if (process.env.CONTAINER_MODE === "true" && (!process.env.BROWSER_REVIEW_URL || process.env.HEADLESS === "true"))
    throw new Error("Final submission requires an interactive browser viewer.");
  const session = sessions.get(id);
  if (!session || session.state !== "ready_for_review") throw new Error("Application is not ready for submission.");
  const page = session.page;
  const button = page.getByRole("button", { name: /^(submit application|submit|send application|apply)$/i }).first();
  if (!(await button.isVisible()) || !(await button.isEnabled())) throw new Error("No enabled final submission button found. Complete site-specific questions manually.");
  await button.click();
  session.state = "submitted";
  session.message = "Submission clicked. Verify the confirmation on the employer website.";
  return status(session);
}
export async function closeApplication(id) {
  const session = sessions.get(id);
  if (!session) return;
  sessions.delete(id);
  await session.browser.close().catch(() => {});
  await rm(session.directory, { recursive: true, force: true }).catch(() => {});
}
export { validateUrl };
