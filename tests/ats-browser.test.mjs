import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fillKnownFields } from "../server/automation.mjs";
import { renderResumePdf } from "../resume-schema/pdf.mjs";
import { decodePdfAttachment } from "../resume-schema/attachment.mjs";
import { adapterForUrl, formState, classifyQuestion, discoverQuestions, fillQuestionAnswers } from "../playwright-adapters/index.mjs";

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

test("Elevance Health JR209310 is Workday, not Greenhouse", () => {
  const url = "https://elevancehealth.wd1.myworkdayjobs.com/en-US/ANT/job/IL-CHICAGO-8600-W-BRYN-MAWR-AVE-10th--11th-FL/Developer-Senior_JR209310";
  assert.equal(adapterForUrl(url)?.id, "workday");
  assert.notEqual(adapterForUrl(url)?.id, "greenhouse");
  assert.equal(new URL(url).hostname, "elevancehealth.wd1.myworkdayjobs.com");
});

test("Smartsheet 8250247 is a Greenhouse-hosted job application", () => {
  const url = "https://job-boards.greenhouse.io/smartsheet/jobs/8250247";
  assert.equal(adapterForUrl(url)?.id, "greenhouse");
  assert.equal(new URL(url).hostname, "job-boards.greenhouse.io");
  assert.equal(formState("Apply for this job", url), "ready_for_review");
  for (const label of ["Applicant Privacy Notice", "Are you legally authorized to work in the United States?", "Do you now or will you in the future require immigration sponsorship for work authorization?"]) {
    assert.equal(classifyQuestion(label), "general");
  }
  for (const label of ["I identify my gender as", "My veteran status is", "I identify my race / ethnicity as"]) {
    assert.equal(classifyQuestion(label), "voluntary");
  }
});

test("sign-in, SSO and challenge detection", () => {
  assert.equal(formState("Create an account to continue", "https://jobs.lever.co/acme/apply"), "login_required");
  assert.equal(formState("Welcome back", "https://acme.wd5.myworkdayjobs.com/login"), "login_required");
  assert.equal(formState("Verify you are human", "https://jobs.ashbyhq.com/acme"), "manual_intervention");
  assert.equal(formState("Submit your application", "https://boards.greenhouse.io/acme/jobs/123"), "ready_for_review");
});

test("five ATS-style browser fixtures: discover and fill employer questions", async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    for (const [id] of Object.entries(samples)) {
      const page = await browser.newPage();
      try {
        await page.setContent(
          '<!doctype html><html><body><main><h1>' + id + ' application</h1>' +
          '<label for="motivation">Why are you interested in this role?</label>' +
          '<textarea id="motivation" required></textarea>' +
          '<label for="experience">Years of experience</label>' +
          '<select id="experience"><option>Choose</option><option>5+</option></select>' +
          '<fieldset><legend>Will you need sponsorship?</legend>' +
          '<label><input type="radio" name="sponsor" value="Yes">Yes</label>' +
          '<label><input type="radio" name="sponsor" value="No">No</label></fieldset>' +
          '<label><input type="checkbox" id="confirm">I confirm these details are accurate</label>' +
          '<label for="password">Password</label><input id="password" type="password">' +
          '<label for="email">Email</label><input id="email" type="email">' +
          '<button type="submit">Submit application</button></main></body></html>'
        );
        const questions = await discoverQuestions(page);
        assert.ok(questions.some(q => q.label === "Why are you interested in this role?" && q.required), id);
        assert.ok(questions.some(q => q.label === "Years of experience"), id);
        assert.equal(questions.some(q => q.label === "Password"), false, id);
        const output = await fillQuestionAnswers(page, questions, {
          "Why are you interested in this role?": "I have relevant experience.",
          "Years of experience": "5+",
          "I confirm these details are accurate": "Yes",
          "Password": "never store",
        });
        assert.deepEqual(output.filled.sort(), ["Why are you interested in this role?", "Years of experience", "I confirm these details are accurate"].sort(), id);
        assert.deepEqual(output.unresolved, ["Password"], id);
        assert.equal(await page.locator("#motivation").inputValue(), "I have relevant experience.");
        assert.equal(await page.locator("#experience").inputValue(), "5+");
        assert.equal(await page.locator("#confirm").isChecked(), true);
        assert.equal(await page.locator("#password").inputValue(), "");
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});

test("Playwright uses structured resume JSON for autofill and the matching PDF for upload", async () => {
  const profile = JSON.parse(readFileSync(new URL("../resume-schema/resume.example.json", import.meta.url), "utf8"));
  profile.contact.firstName = "Ada";
  profile.contact.lastName = "Lovelace";
  profile.contact.email = "ada@example.com";
  const pdf = renderResumePdf(profile);
  const attachment = decodePdfAttachment({
    fileName: "Ada-Lovelace.pdf",
    base64: Buffer.from(pdf).toString("base64"),
  });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    for (const url of [
      "https://job-boards.greenhouse.io/example/jobs/123",
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
        const result = await fillKnownFields(page, profile);
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
          const file = input.files?.[0];
          const bytes = file ? new Uint8Array(await file.arrayBuffer()) : null;
          return { name: file?.name, type: file?.type, prefix: bytes ? String.fromCharCode(...bytes.slice(0, 5)) : "" };
        });
        assert.deepEqual(upload, { name: "Ada-Lovelace.pdf", type: "application/pdf", prefix: "%PDF-" });
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});
