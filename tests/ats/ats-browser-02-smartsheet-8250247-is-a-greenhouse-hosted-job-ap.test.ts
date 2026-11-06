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


