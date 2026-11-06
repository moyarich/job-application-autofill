import { test } from "vitest";
import assert from "node:assert/strict";


import { adapterForUrl } from "../../packages/job-sites/index.ts";

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


