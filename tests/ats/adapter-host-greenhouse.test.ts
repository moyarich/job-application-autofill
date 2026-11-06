import { test } from "vitest";
import assert from "node:assert/strict";
import { adapterForUrl } from "../../packages/job-sites/index.ts";

test("greenhouse adapter host recognition", () => {
  const url = "https://boards.greenhouse.io/acme/jobs/123";
  assert.equal(adapterForUrl(url)?.id, "greenhouse");
  assert.equal(adapterForUrl(url.replace("https:", "http:"))?.id, "greenhouse");
  assert.equal(adapterForUrl("https://jobs.greenhouse.com.bad.example"), null);
});
