// Read-only live employer ATS smoke checks; no credentials, autofill or submission.
// Set ATS_LIVE_URLS to a JSON object keyed by adapter ID.
import { chromium } from "playwright";
import { adapterForUrl, discoverQuestions, formState } from "../packages/job-sites/index.mjs";

const raw = process.env.ATS_LIVE_URLS;
if (!raw) {
  console.error("Set ATS_LIVE_URLS to a JSON object mapping ATS names to public application URLs.");
  process.exit(2);
}
const targets = JSON.parse(raw);
const browser = await chromium.launch({ headless: true });
const report = [];
try {
  for (const [id, url] of Object.entries(targets)) {
    if (typeof url !== "string" || adapterForUrl(url)?.id !== id || new URL(url).protocol !== "https:") {
      report.push({ ats: id, result: "invalid_target" });
      continue;
    }
    const page = await browser.newPage({ acceptDownloads: false });
    try {
      // GET/navigation only. No form values are sent to employer systems.
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      const text = (await page.locator("body").innerText({ timeout: 10000 })).slice(0, 12000);
      report.push({
        ats: id,
        state: formState(text, page.url()),
        returnedAts: adapterForUrl(page.url())?.id || null,
        questions: (await discoverQuestions(page)).map(q => ({
          label: q.label, kind: q.kind, required: q.required,
        })),
        result: "inspected",
      });
    } catch (error) {
      report.push({ ats: id, result: "error", message: error.message });
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
console.log(JSON.stringify(report, null, 2));
if (report.some(item => item.result !== "inspected")) process.exitCode = 1;
