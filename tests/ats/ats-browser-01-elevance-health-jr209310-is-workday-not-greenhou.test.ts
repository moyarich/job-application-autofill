import { test } from "vitest";
import assert from "node:assert/strict";

import { adapterForUrl } from "../../packages/job-sites/index.ts";

test("Elevance Health JR209310 is Workday, not Greenhouse", () => {
  const url =
    "https://elevancehealth.wd1.myworkdayjobs.com/en-US/ANT/job/IL-CHICAGO-8600-W-BRYN-MAWR-AVE-10th--11th-FL/Developer-Senior_JR209310";
  assert.equal(adapterForUrl(url)?.id, "workday");
  assert.notEqual(adapterForUrl(url)?.id, "greenhouse");
  assert.equal(new URL(url).hostname, "elevancehealth.wd1.myworkdayjobs.com");
});
