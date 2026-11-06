import { test } from "vitest";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fillWorkdayContact } from "../../packages/job-sites/workday/contact.ts";
import { renderResumePdf } from "../../packages/resume/src/resume-schema/create-pdf.ts";
import { decodePdfAttachment } from "../../packages/resume/src/resume-schema/attachment.ts";
import { adapterForUrl } from "../../packages/job-sites/index.ts";

const samples = {
  greenhouse: ["https://boards.greenhouse.io/acme/jobs/123", "First Name", "Last Name"],
  lever: ["https://jobs.lever.co/acme/123", "Full name", "Email"],
  ashby: ["https://jobs.ashbyhq.com/acme/123", "Full Name", "Email"],
  workday: ["https://acme.wd5.myworkdayjobs.com/Careers/job/123", "First Name", "Last Name"],
  "smart-recruiters": ["https://jobs.smartrecruiters.com/acme/123", "Full Name", "Email"],
};

for (const [id, [url]] of Object.entries(samples)) {
  test(id + " adapter host recognition", () => {
    assert.equal(adapterForUrl(url)?.id, id);
    assert.equal(adapterForUrl(url.replace("https:", "http:"))?.id, id);
    assert.equal(adapterForUrl("https://jobs." + id + ".com.bad.example"), null);
  });
}


test("Workday contact handler uses structured resume JSON and the matching PDF for upload", async () => {
  const profile = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json", import.meta.url), "utf8"));
  profile.contact.firstName = "Ada";
  profile.contact.lastName = "Lovelace";
  profile.contact.email = "ada@example.com";
  const pdf = await renderResumePdf(profile);
  assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), "%PDF-");
  const attachment = decodePdfAttachment({
    fileName: "Ada-Lovelace.pdf",
    base64: Buffer.from(pdf).toString("base64"),
  });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    for (const url of [
      "https://example.wd1.myworkdayjobs.com/en-US/example/job/123",
    ]) {
      const page = await browser.newPage();
      try {
        await page.route(url, route => route.fulfill({
          status: 200,
          contentType: "text/html",
          body: '<!doctype html><html><body><form>' +
            '<label>First Name<input name="firstName"></label>' +
            '<label>Last Name<input name="lastName"></label>' +
            '<label>Email<input name="email" type="email"></label>' +
            '<label>Resume<input name="resume" type="file" accept=".pdf"></label>' +
            '</form></body></html>',
        }));
        await page.goto(url, { waitUntil: "domcontentloaded" });
        const result = await fillWorkdayContact(page, profile);
        assert.ok(result.filled.includes("firstName"), url);
        assert.ok(result.filled.includes("lastName"), url);
        assert.ok(result.filled.includes("email"), url);
        assert.equal(await page.locator('[name=firstName]').inputValue(), "Ada");
        assert.equal(await page.locator('[name=lastName]').inputValue(), "Lovelace");
        assert.equal(await page.locator('[name=email]').inputValue(), "ada@example.com");
        await page.locator('input[type="file"]').setInputFiles({
          name: attachment.fileName,
          mimeType: "application/pdf",
          buffer: attachment.buffer,
        });
        const upload = await page.locator('input[type="file"]').evaluate(async input => {
          const file = (input as HTMLInputElement).files?.[0];
          const bytes = file ? new Uint8Array(await file.arrayBuffer()) : null;
          return { name: file?.name, type: file?.type, prefix: bytes ? String.fromCharCode(...bytes.slice(0, 5)) : "" };
        });
        assert.deepEqual(upload, { name: "Ada-Lovelace.pdf", type: "application/pdf", prefix: "%PDF-" });
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
}, 30_000);
