import { test, expect } from "@playwright/test";
import { workdaySteps } from "../../packages/job-boards/workday/steps.ts";
import type { JobSiteStepContext } from "../../packages/job-boards/types.ts";

test("Workday does not repeat upload on a completed or unusable file control", async ({ page }) => {
  const step = workdaySteps.find((entry) => entry.id === "workday.resume");
  if (!step) throw new Error("Missing resume step");
  const context = {
    page, pendingResume: { fileName: "resume.pdf", buffer: Buffer.from("pdf") },
    resumeUploadUrls: [],
  } as unknown as JobSiteStepContext;
  await page.setContent('<input type="file" disabled />');
  expect(await step.matches(context)).toBe(false);
  await page.setContent('<input type="file" style="display:none" />');
  expect(await step.matches(context)).toBe(true);
  context.resumeUploadUrls = [page.url()];
  expect(await step.matches(context)).toBe(false);
  context.resumeUploadUrls = [];
  await page.locator('input[type="file"]').setInputFiles({
    name: "existing.pdf", mimeType: "application/pdf", buffer: Buffer.from("pdf"),
  });
  expect(await step.matches(context)).toBe(false);
});
