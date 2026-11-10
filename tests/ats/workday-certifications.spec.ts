import { test, expect } from "@playwright/test";
import {
  fillWorkdayCertifications,
  workdayCertificationsVisible,
} from "../../packages/job-boards/workday/certifications/certifications.ts";
import { workdaySteps } from "../../packages/job-boards/workday/steps.ts";
import type { Resume } from "../../packages/resume/src/types.ts";
import type { JobSiteStepContext } from "../../packages/job-boards/types.ts";

const certificate = (name: string) => ({
  name,
  issuer: "AWS",
  issuedDate: "2025-10",
  expirationDate: "2028-10",
  credentialId: "",
  url: "",
});

test("Workday certification cards fill idempotently without selecting another card", async ({ page }) => {
  await page.setContent(`
    <div role="group" aria-label="Certification 1">
      <label>Certification<input value="Existing Certificate" /></label>
      <label>Issuer<input value="Other" /></label>
    </div>
    <div role="group" aria-label="Certification 2">
      <label>Certification<input /></label>
      <label>Issuer<input /></label>
      <label>Issue Date<input type="month" /></label>
      <label>Expiration Date<input type="month" /></label>
    </div>
  `);
  expect(await workdayCertificationsVisible(page)).toBe(true);
  const entries = [certificate("AWS Developer")];
  const first = await fillWorkdayCertifications(page, entries);
  expect(first).toEqual({ filled: ["certifications[0]"], unresolved: [] });
  expect(await page.getByRole("group", { name: "Certification 1" }).getByLabel("Certification").inputValue())
    .toBe("Existing Certificate");
  const row = page.getByRole("group", { name: "Certification 2" });
  expect(await row.getByLabel("Certification").inputValue()).toBe("AWS Developer");
  expect(await row.getByLabel("Issue Date").inputValue()).toBe("2025-10");
  expect(await row.getByLabel("Expiration Date").inputValue()).toBe("2028-10");
  expect(await fillWorkdayCertifications(page, entries)).toEqual(first);
});

test("Workday certifications leave unsupported date widgets and conflicting values for review", async ({ page }) => {
  await page.setContent(`
    <div role="group" aria-label="Certification 1">
      <label>Certification<input value="AWS Developer" /></label>
      <label>Issuer<input value="Different issuer" /></label>
      <label>Issue Date<input type="date" /></label>
    </div>
  `);
  const result = await fillWorkdayCertifications(page, [certificate("AWS Developer")]);
  expect(result.filled).toEqual([]);
  expect(result.unresolved).toEqual(["certifications[0]: issuer, issuedDate, expirationDate"]);
  expect(await page.getByLabel("Issuer").inputValue()).toBe("Different issuer");
  expect(await page.getByLabel("Issue Date").inputValue()).toBe("");
});

test("Workday certification step matches only an active editable card", async ({ page }) => {
  const step = workdaySteps.find((item) => item.id === "workday.certifications");
  expect(step).toBeDefined();
  const context = {
    page,
    profile: { certifications: [certificate("AWS Developer")] } as Resume,
  } as JobSiteStepContext;
  await page.setContent("<h2>Certifications</h2>");
  expect(await step!.matches(context)).toBe(false);
  await page.setContent('<div role="group" aria-label="Certification 1"><label>Certification<input /></label></div>');
  expect(await step!.matches(context)).toBe(true);
  context.profile.certifications = [];
  expect(await step!.matches(context)).toBe(false);
});
