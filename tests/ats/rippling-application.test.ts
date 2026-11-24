import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { expect, it } from "vitest";
import { adapterForUrl } from "../../packages/job-boards/index.ts";
import { automateCurrentStep } from "../../packages/job-boards/core/orchestrator.ts";

it("opens a Rippling application and fills only known, empty fields", async () => {
  const host = "ats.rippling.com";
  const listing = `https://${host}/aalyria-careers/jobs/31eafdd0-f84e-45a5-a5c6-e6a4cacc6b32`;
  const application = `${listing}/apply?step=application`;
  const adapter = adapterForUrl(listing);
  expect(adapter?.id).toBe("rippling");
  if (!adapter?.openApplication) throw new Error("Rippling adapter is missing");
  expect(adapter.employerTenant(new URL(listing))).toBe("aalyria-careers");
  const profile = JSON.parse(
    readFileSync(
      "packages/resume/src/resume-schema/resume.example.json",
      "utf8",
    ),
  );
  profile.contact.phone = "+1 4155550123";
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route(listing, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<button onclick="location.href='${application}'">Apply now</button>`,
      }),
    );
    await page.route(application, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<form>
          <input data-testid="input-first_name">
          <input data-testid="input-last_name">
          <input data-testid="input-email" value="edited@example.com">
          <div><input role="combobox" value="+1 US"><input data-testid="input-phone_number"></div>
          <input data-testid="input-resume" type="file" hidden>
          <input data-testid="input-cover_letter" type="file">
          <input aria-label="Applicant screening question">
          <button>Submit</button>
        </form>`,
      }),
    );
    await page.goto(listing);
    await adapter.openApplication(page);
    await adapter.openApplication(page);
    const outcome = await automateCurrentStep(
      {
        page,
        expectedHost: host,
        profile,
        directory: "",
        pendingResume: {
          fileName: "resume.pdf",
          buffer: Buffer.from("%PDF-1.4"),
        },
      },
      adapter,
    );
    expect(outcome.filled).toEqual([
      "First name",
      "Last name",
      "Phone number",
      "Resume",
    ]);
    expect(outcome.pendingResume).toBeNull();
    expect(await page.getByTestId("input-email").inputValue()).toBe(
      "edited@example.com",
    );
    expect(await page.getByTestId("input-phone_number").inputValue()).toBe(
      "4155550123",
    );
    expect(await page.getByTestId("input-resume").inputValue()).toMatch(
      /resume\.pdf$/,
    );
    expect(await page.getByTestId("input-cover_letter").inputValue()).toBe("");
    expect(
      await page.getByLabel("Applicant screening question").inputValue(),
    ).toBe("");
    expect(page.url()).toBe(application);
  } finally {
    await browser.close();
  }
});
