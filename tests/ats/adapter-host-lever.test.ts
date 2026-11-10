import { test } from "vitest";
import assert from "node:assert/strict";
import { adapterForUrl } from "../../packages/job-sites/index.ts";

test("lever adapter host recognition", () => {
  const url = "https://jobs.lever.co/acme/123";
  assert.equal(adapterForUrl(url)?.id, "lever");
  assert.equal(adapterForUrl(url.replace("https:", "http:"))?.id, "lever");
  assert.equal(adapterForUrl("https://jobs.lever.com.bad.example"), null);
});
