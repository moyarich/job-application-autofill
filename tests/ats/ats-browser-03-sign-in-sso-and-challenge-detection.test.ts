import { test } from "vitest";
import assert from "node:assert/strict";


import { formState } from "../../packages/job-sites/index.ts";


test("sign-in, SSO and challenge detection", () => {
  assert.equal(formState("Create an account to continue", "https://jobs.lever.co/acme/apply"), "login_required");
  assert.equal(formState("Welcome back", "https://acme.wd5.myworkdayjobs.com/login"), "login_required");
  assert.equal(formState("Verify you are human", "https://jobs.ashbyhq.com/acme"), "manual_intervention");
  assert.equal(formState("Submit your application", "https://boards.greenhouse.io/acme/jobs/123"), "ready_for_review");
});


