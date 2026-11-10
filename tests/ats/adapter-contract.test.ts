import { describe, expect, it } from "vitest";
import { ADAPTERS, adapterForUrl } from "../../packages/job-sites/index.ts";

describe("job-site adapter contract", () => {
  it("registers typed adapters with their own employer identity rules", () => {
    const examples = [
      ["greenhouse", "https://boards.greenhouse.io/acme/jobs/123", "acme"],
      ["lever", "https://jobs.lever.co/acme/123", "acme"],
      ["ashby", "https://jobs.ashbyhq.com/acme/123", "acme"],
      ["smart-recruiters", "https://jobs.smartrecruiters.com/acme/123", "acme"],
      [
        "workday",
        "https://acme.wd5.myworkdayjobs.com/Careers/job/123",
        "acme.wd5.myworkdayjobs.com",
      ],
    ] as const;

    for (const [id, url, tenant] of examples) {
      const adapter = adapterForUrl(url);
      expect(adapter?.id).toBe(id);
      expect(adapter?.employerTenant(new URL(url))).toBe(tenant);
      expect(adapter).toBe(ADAPTERS[id]);
    }
  });

  it("Workday declares only its own site-specific steps and menu actions", () => {
    const workday = ADAPTERS.workday;
    const steps = workday.steps ?? [];
    const stepIds = steps.map((step) => step.id);
    expect(stepIds.length).toBeGreaterThan(0);
    expect(new Set(stepIds).size).toBe(stepIds.length);
    for (const id of stepIds) expect(id).toMatch(/^workday\\.[a-z][a-z0-9-]*$/);
    for (const step of steps) {
      expect(step.matches).toBeTypeOf("function");
      expect(step.run).toBeTypeOf("function");
    }
    const menu = workday.menuItems ?? [];
    expect(menu.length).toBeGreaterThan(0);
    expect(new Set(menu.map((item) => item.id)).size).toBe(menu.length);
    for (const item of menu) {
      expect(item.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(item.label.trim()).not.toBe("");
      expect(stepIds).toContain(item.stepId);
    }

    expect(workday.detectPage).toBeTypeOf("function");
    expect(workday.openApplication).toBeTypeOf("function");
    expect(workday.helpSignIn).toBeTypeOf("function");
    expect(workday.loginFailureMessage).toBeTypeOf("function");
    expect(
      workday.loginFailureMessage?.("wrong email address or password"),
    ).toMatch(/Workday/);
    expect(ADAPTERS.lever.menuItems).toBeUndefined();
    expect(ADAPTERS.lever.loginFailureMessage).toBeUndefined();
  });

  it("preserves Greenhouse custom-host tenant isolation", () => {
    const url = "https://careers.greenhouse.io/acme/jobs/123";
    expect(adapterForUrl(url)?.employerTenant(new URL(url))).toBe(
      "careers.greenhouse.io/acme",
    );
  });
});
