import { test } from "vitest";
import assert from "node:assert/strict";
import { adapterForUrl } from "../../packages/job-sites/index.ts";

test("workday adapter host recognition", () => {
  const url = "https://acme.wd5.myworkdayjobs.com/Careers/job/123";
  assert.equal(adapterForUrl(url)?.id, "workday");
  assert.equal(adapterForUrl(url.replace("https:", "http:"))?.id, "workday");
  assert.equal(adapterForUrl("https://jobs.workday.com.bad.example"), null);
});
