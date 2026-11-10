import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { ADAPTERS } from "../../packages/job-sites/index.ts";
import type {
  JobSiteAdapter,
  JobSiteStepContext,
} from "../../packages/job-sites/types.ts";
import {
  executeJobSiteMenuItem,
  listJobSiteMenu,
} from "../../packages/job-sites/core/orchestrator.ts";

function fakePage() {
  return {
    url: () => "https://jobs.lever.co/acme/123",
    locator: () => ({ innerText: async () => "Application" }),
  } as unknown as Page;
}

function createContext(
  page: Page,
): JobSiteStepContext & { expectedHost: string } {
  return {
    page,
    expectedHost: "jobs.lever.co",
    directory: "/tmp",
    profile: {} as JobSiteStepContext["profile"],
    pendingResume: null,
  };
}

describe("provider-owned floating menu", () => {
  it("Workday lists only its explicitly configured menu actions", () => {
    const menu = ADAPTERS.workday.menuItems ?? [];
    expect(menu.length).toBeGreaterThan(0);
    expect(new Set(menu.map((item) => item.id)).size).toBe(menu.length);
    const steps = new Set(ADAPTERS.workday.steps?.map((item) => item.id));
    for (const item of menu) {
      expect(item.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(item.label.trim()).not.toBe("");
      expect(steps.has(item.stepId)).toBe(true);
    }
    expect(ADAPTERS.lever.menuItems).toBeUndefined();
  });

  it("runs only the selected declared menu step and rejects arbitrary actions", async () => {
    const calls: string[] = [];
    const adapter: JobSiteAdapter = {
      id: "lever",
      label: "Fixture",
      hosts: ["lever.co"],
      employerTenant: () => "acme",
      menuItems: [
        { id: "portfolio", label: "Portfolio", stepId: "fixture.portfolio" },
      ],
      steps: [
        {
          id: "fixture.portfolio",
          matches: async () => true,
          run: async () => {
            calls.push("portfolio");
            return { filled: ["portfolio"], missing: [] };
          },
        },
        {
          id: "fixture.hidden",
          matches: async () => true,
          run: async () => {
            calls.push("hidden");
            return { filled: ["hidden"], missing: [] };
          },
        },
      ],
    };
    const context = createContext(fakePage());
    expect(await listJobSiteMenu(context, adapter)).toEqual([
      { id: "portfolio", label: "Portfolio", available: true },
    ]);
    const result = await executeJobSiteMenuItem(context, adapter, "portfolio");
    expect(result.executed).toEqual(["fixture.portfolio"]);
    expect(calls).toEqual(["portfolio"]);
    await expect(
      executeJobSiteMenuItem(context, adapter, "fixture.hidden"),
    ).rejects.toThrow("Unknown employer menu action");
  });

  it("disables items that do not match the employer page", async () => {
    const adapter: JobSiteAdapter = {
      id: "lever",
      label: "Fixture",
      hosts: ["lever.co"],
      employerTenant: () => "acme",
      menuItems: [
        { id: "missing", label: "Missing step", stepId: "fixture.missing" },
      ],
      steps: [
        {
          id: "fixture.missing",
          matches: async () => false,
          run: async () => ({ filled: [], missing: [] }),
        },
      ],
    };
    expect(await listJobSiteMenu(createContext(fakePage()), adapter)).toEqual([
      { id: "missing", label: "Missing step", available: false },
    ]);
  });
});
