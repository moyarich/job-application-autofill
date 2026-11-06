import { test } from "vitest";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fillKnownFields } from "../../packages/job-sites/automation.ts";
import { renderResumePdf } from "../../packages/resume/src/resume-schema/create-pdf.ts";
import { decodePdfAttachment } from "../../packages/resume/src/resume-schema/attachment.ts";
import { adapterForUrl, formState, classifyQuestion, discoverQuestions, fillQuestionAnswers } from "../../packages/job-sites/index.ts";

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


test("sign-in, SSO and challenge detection", () => {
  assert.equal(formState("Create an account to continue", "https://jobs.lever.co/acme/apply"), "login_required");
  assert.equal(formState("Welcome back", "https://acme.wd5.myworkdayjobs.com/login"), "login_required");
  assert.equal(formState("Verify you are human", "https://jobs.ashbyhq.com/acme"), "manual_intervention");
  assert.equal(formState("Submit your application", "https://boards.greenhouse.io/acme/jobs/123"), "ready_for_review");
});


