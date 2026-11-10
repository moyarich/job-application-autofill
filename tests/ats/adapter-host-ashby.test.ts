import { test } from "vitest";
import assert from "node:assert/strict";
import { adapterForUrl } from "../../packages/job-sites/index.ts";

test("ashby adapter host recognition", () => {
  const url = "https://jobs.ashbyhq.com/acme/123";
  assert.equal(adapterForUrl(url)?.id, "ashby");
  assert.equal(adapterForUrl(url.replace("https:", "http:"))?.id, "ashby");
  assert.equal(adapterForUrl("https://jobs.ashby.com.bad.example"), null);
});
