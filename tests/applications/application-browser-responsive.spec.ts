import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

for (const width of [375, 768, 1440]) {
  test(`apply viewer controls work and fit at ${width}px`, async ({
    page,
    context,
  }) => {
    const profileId = "00000000-0000-4000-8000-000000000001";
    const resumeId = "00000000-0000-4000-8000-000000000002";
    const contactId = "00000000-0000-4000-8000-000000000003";
    const jobId = "00000000-0000-4000-8000-000000000004";
    const profile = JSON.parse(
      readFileSync(
        "packages/resume/src/resume-schema/resume.example.json",
        "utf8",
      ),
    );
    const question = "Describe your integration experience";
    const session = {
      id: "fixture-session",
      jobId,
      state: "ready_for_review",
      ats: "workday",
      message: "Review the employer form.",
      url: "https://example.com/jobs/42",
      reviewUrl: "http://localhost:6080",
      filled: [],
      missing: [],
      questions: [
        { label: question, kind: "textarea", required: true, options: [] },
      ],
    };
    await context.route(
      (url) => url.pathname.startsWith("/api/"),
      (route) => {
        const path = new URL(route.request().url()).pathname;
        const json =
          path === "/api/profiles"
            ? {
                profiles: [{ id: profileId, name: "Default" }],
                defaultProfileId: profileId,
              }
            : path === "/api/resumes"
              ? {
                  resumes: [
                    { id: resumeId, name: "Selected resume", contactId },
                  ],
                }
              : path === "/api/profile-contacts"
                ? {
                    contacts: [
                      { ...profile.contact, id: contactId, isDefault: true },
                    ],
                  }
                : path.endsWith("/content")
                  ? { profile, revision: 1, contactId }
                  : path === "/api/jobs"
                    ? {
                        jobs: [
                          {
                            id: jobId,
                            company: "Example",
                            role: "Senior Developer",
                            url: session.url,
                            status: "in_progress",
                            resumeId,
                          },
                        ],
                        revisions: { [jobId]: 1 },
                      }
                    : path === "/api/apply/active"
                      ? { session }
                      : path === "/api/viewer/config"
                        ? { password: "fixture" }
                        : path.endsWith("/menu")
                          ? { items: [], session }
                          : session;
        return route.fulfill({ json });
      },
    );
    await context.route("**/vnc/core/rfb.js*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `
      export default class RFB extends EventTarget {
        constructor() { super(); window.__rfbForTest = this; setTimeout(() => this.dispatchEvent(new Event('connect')), 0); }
        focus() {} disconnect() {}
      }`,
      }),
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/apply/${jobId}?profile=${profileId}&resume=${resumeId}`);
    const viewer = page.frameLocator(
      'iframe[title="Interactive Playwright application browser"]',
    );
    await expect(viewer.locator("#status")).toHaveText(
      "Connected to application browser",
    );
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page
      .getByRole("button", { name: "Employer actions", exact: true })
      .click();
    await expect(viewer.locator("#menu-handle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await page
      .getByRole("button", { name: "Actual size", exact: true })
      .click();
    await expect
      .poll(() =>
        viewer.locator("body").evaluate(
          () =>
            (
              window as unknown as {
                __rfbForTest: { scaleViewport: boolean };
              }
            ).__rfbForTest.scaleViewport,
        ),
      )
      .toBe(false);
    await page
      .getByRole("button", { name: "Fit to view", exact: true })
      .click();
    await expect
      .poll(() =>
        viewer.locator("body").evaluate(
          () =>
            (
              window as unknown as {
                __rfbForTest: { scaleViewport: boolean };
              }
            ).__rfbForTest.scaleViewport,
        ),
      )
      .toBe(true);
    if (width === 375)
      await page.screenshot({
        path: "/tmp/apply-mobile-responsive.png",
        fullPage: true,
      });
    await page.getByRole("button", { name: /^Screening answers/ }).click();
    const popup = page.getByRole("dialog", {
      name: "Screening answer assistant",
    });
    await expect(popup).toBeVisible();
    await popup
      .getByRole("textbox", { name: "Suggested answer for " + question })
      .fill("My role-specific draft");
    if (width === 1440) {
      await page
        .getByRole("button", { name: "Full screen", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Exit full screen", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await page
        .getByRole("button", { name: "Exit full screen", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Full screen", exact: true }),
      ).toHaveAttribute("aria-pressed", "false");
      await page
        .getByRole("button", { name: "Full screen", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Exit full screen", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await page.evaluate(() => document.exitFullscreen());
      await expect(
        page.getByRole("button", { name: "Full screen", exact: true }),
      ).toHaveAttribute("aria-pressed", "false");
      const before = (await popup.boundingBox())!;
      const header = (await popup.locator("header").boundingBox())!;
      await page.mouse.move(header.x + 40, header.y + 16);
      await page.mouse.down();
      await page.mouse.move(header.x - 40, header.y - 44, { steps: 5 });
      await page.mouse.up();
      const moved = (await popup.boundingBox())!;
      expect(moved.x).toBeLessThan(before.x - 50);
      expect(moved.y).toBeLessThan(before.y - 30);
      const resize = (await popup
        .getByRole("button", { name: "Resize screening answers" })
        .boundingBox())!;
      await page.mouse.move(resize.x + 12, resize.y + 12);
      await page.mouse.down();
      await page.mouse.move(resize.x + 72, resize.y + 52, { steps: 5 });
      await page.mouse.up();
      const resized = (await popup.boundingBox())!;
      expect(resized.width).toBeGreaterThan(moved.width + 40);
      expect(resized.height).toBeGreaterThan(moved.height + 20);
    }
    await popup
      .getByRole("button", { name: "Minimize screening answers" })
      .click();
    await expect(popup).toHaveCount(0);
    await page.getByRole("button", { name: /^Screening answers/ }).click();
    await expect(
      popup.getByRole("textbox", { name: "Suggested answer for " + question }),
    ).toHaveValue("My role-specific draft");
    await page.setViewportSize({ width: 320, height: 600 });
    await expect
      .poll(() =>
        popup.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.left >= 0 &&
            rect.top >= 0 &&
            rect.right <= innerWidth &&
            rect.bottom <= innerHeight
          );
        }),
      )
      .toBe(true);
    if (width === 375)
      await page.screenshot({ path: "/tmp/screening-answer-popup.png" });
    await popup.press("Escape");
    await expect(popup).toHaveCount(0);
  });
}
