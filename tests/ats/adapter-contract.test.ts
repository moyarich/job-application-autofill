import { describe, expect, it } from "vitest";
import { ADAPTERS, adapterForUrl } from "../../packages/job-sites/index.ts";

describe("job-site adapter contract", () => {
  it("registers typed adapters with their own employer identity rules", () => {
    const examples = [
      ["greenhouse", "https://boards.greenhouse.io/acme/jobs/123", "acme"],
      ["lever", "https://jobs.lever.co/acme/123", "acme"],
      ["ashby", "https://jobs.ashbyhq.com/acme/123", "acme"],
      ["smart-recruiters", "https://jobs.smartrecruiters.com/acme/123", "acme"],
      ["workday", "https://acme.wd5.myworkdayjobs.com/Careers/job/123", "acme.wd5.myworkdayjobs.com"],
    ] as const;

    for (const [id, url, tenant] of examples) {
      const adapter = adapterForUrl(url);
      expect(adapter?.id).toBe(id);
      expect(adapter?.employerTenant(new URL(url))).toBe(tenant);
      expect(adapter).toBe(ADAPTERS[id]);
    }
  });

  it("only the Workday adapter owns Workday-specific browser hooks", () => {
    expect(ADAPTERS.workday.fillProfile).toBeTypeOf("function");
    expect(ADAPTERS.workday.retryResumeUpload).toBeTypeOf("function");
    expect(ADAPTERS.workday.openApplication).toBeTypeOf("function");
    expect(ADAPTERS.workday.helpSignIn).toBeTypeOf("function");
    expect(ADAPTERS.workday.loginFailureMessage).toBeTypeOf("function");
    expect(ADAPTERS.workday.loginFailureMessage?.("wrong email address or password")).toMatch(/Workday/);
    expect(ADAPTERS.lever.loginFailureMessage).toBeUndefined();
  });

  it("preserves Greenhouse custom-host tenant isolation", () => {
    const url = "https://careers.greenhouse.io/acme/jobs/123";
    expect(adapterForUrl(url)?.employerTenant(new URL(url))).toBe("careers.greenhouse.io/acme");
  });
});
