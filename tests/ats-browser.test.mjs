import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
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
