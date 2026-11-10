import { expect, it } from "vitest";
import type { Page } from "playwright";
import type {
  JobSiteAdapter,
  JobSiteStepContext,
} from "../../packages/job-sites/types.ts";
import { automateCurrentStep } from "../../packages/job-sites/core/orchestrator.ts";

it("runs only matching site-defined operations without a predefined section list", async () => {
  const page = {
    url: () => "https://jobs.lever.co/acme/123",
    locator: () => ({ innerText: async () => "Application" }),
  } as unknown as Page;
  const events: string[] = [];
  const adapter: JobSiteAdapter = {
    id: "lever",
    label: "Custom",
    hosts: ["lever.co"],
    employerTenant: () => "acme",
    steps: [
      {
        id: "custom.portfolio",
        matches: async () => true,
        run: async () => {
          events.push("portfolio");
          return { filled: ["portfolio"], missing: [] };
        },
      },
      {
        id: "custom.references",
        matches: async () => false,
        run: async () => {
          events.push("references");
          return { filled: [], missing: [] };
        },
      },
    ],
  };
  const context: JobSiteStepContext & { expectedHost: string } = {
    page,
    expectedHost: "jobs.lever.co",
    profile: {} as JobSiteStepContext["profile"],
    directory: "/tmp",
    pendingResume: null,
  };
  const outcome = await automateCurrentStep(context, adapter);
  expect(outcome.executed).toEqual(["custom.portfolio"]);
  expect(outcome.filled).toEqual(["portfolio"]);
  expect(events).toEqual(["portfolio"]);
  expect(outcome.missing).toEqual([]);
});
