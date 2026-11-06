import { test } from "vitest";
import assert from "node:assert/strict";
import { adapterForUrl } from "../../packages/job-sites/index.ts";

test("smart-recruiters adapter host recognition", () => {
  const url = "https://jobs.smartrecruiters.com/acme/123";
  assert.equal(adapterForUrl(url)?.id, "smart-recruiters");
  assert.equal(adapterForUrl(url.replace("https:", "http:"))?.id, "smart-recruiters");
  assert.equal(adapterForUrl("https://jobs.smart-recruiters.com.bad.example"), null);
});
