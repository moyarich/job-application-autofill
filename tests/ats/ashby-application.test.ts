import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { expect, it } from "vitest";
import ashby from "../../packages/job-boards/boards/ashby/index.ts";
import { automateCurrentStep } from "../../packages/job-boards/core/orchestrator.ts";

it("opens an Ashby posting's application and prepares it for review", async () => {
  const path = "/render/c7d896f2-20a9-4b44-9f7d-13929a0fe453";
  const host = "jobs.ashbyhq.com";
  const listing = `https://${host}${path}/`;
  const application = `https://${host}${path}/application`;
  const profile = JSON.parse(
    readFileSync(
      "packages/resume/src/resume-schema/resume.example.json",
      "utf8",
    ),
  );
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route(listing, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<a href="${path}/application">Apply for this Job</a>`,
      }),
    );
    await page.route(application, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<div class="ashby-application-form-container">
          <input aria-label="Autofill from resume" type="file">
          <input aria-label="Name" name="_systemfield_name">
          <input aria-label="Email" name="_systemfield_email" value="edited@example.com">
          <input aria-label="Location">
          <input aria-label="Current or Most Recent Company">
          <input aria-label="Resume" id="_systemfield_resume" type="file" hidden>
          <input aria-label="Cover Letter" type="file">
          <input aria-label="Will you require sponsorship?">
          <button onclick="location.href='/submitted'">Submit Application</button>
        </div>`,
      }),
    );
    await page.goto(listing);
    await ashby.openApplication(page);
    expect(page.url()).toBe(application);

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
      ashby,
    );
    expect(outcome.filled).toEqual([
      "Name",
      "Location",
      "Current or Most Recent Company",
      "Resume",
    ]);
    expect(outcome.pendingResume).toBeNull();
    expect(await page.getByLabel("Name", { exact: true }).inputValue()).toBe(
      "Ada Lovelace",
    );
    expect(await page.getByLabel("Email").inputValue()).toBe(
      "edited@example.com",
    );
    expect(
      await page.getByLabel("Resume", { exact: true }).inputValue(),
    ).toMatch(/resume\.pdf$/);
    expect(await page.getByLabel("Autofill from resume").inputValue()).toBe("");
    expect(await page.getByLabel("Cover Letter").inputValue()).toBe("");
    expect(
      await page.getByLabel("Will you require sponsorship?").inputValue(),
    ).toBe("");
    expect(page.url()).toBe(application);
  } finally {
    await browser.close();
  }
});
