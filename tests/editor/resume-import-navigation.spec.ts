import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

for (const width of [1440, 375]) {
  test(`empty resume import stays compact at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route(
      (url) => url.pathname.startsWith("/api/"),
      async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/resume/parse") {
          const profile = JSON.parse(
            readFileSync(
              "packages/resume/src/resume-schema/resume.example.json",
              "utf8",
            ),
          );
          await route.fulfill({
            json: { profile, preview: "Extracted resume text", warnings: [] },
          });
          return;
        }
        const json =
          path === "/api/profiles"
            ? {
                profiles: [{ id: "default", name: "Default" }],
                defaultProfileId: "default",
              }
            : { resumes: [], contacts: [] };
        await route.fulfill({ json });
      },
    );
    await page.goto("/resumes/import?profile=default");
    const browse = page.getByRole("button", { name: "Browse files" });
    await expect(browse).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Resume details" }),
    ).toHaveCount(0);
    const jsonButton = page.getByRole("button", { name: "Choose JSON file" });
    await expect(jsonButton).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByLabel("Choose resume document").setInputFiles({
      name: "resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4"),
    });
    await expect(
      page.getByRole("button", { name: "Extract details" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Remove selected file" }).click();
    await expect(
      page.getByRole("button", { name: "Extract details" }),
    ).toBeDisabled();
    await page.getByLabel("Choose resume document").setInputFiles({
      name: "resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4"),
    });
    await page.getByRole("button", { name: "Extract details" }).click();
    await expect(
      page.getByRole("region", { name: "Extraction complete" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Browse files" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Import resume", exact: true }),
    ).toBeInViewport();
    await page.getByRole("button", { name: "Cancel import" }).click();
    await expect(
      page.getByRole("button", { name: "Choose another file" }),
    ).toBeVisible();
    await page.screenshot({
      path: `/tmp/compact-import-${width}.png`,
      fullPage: true,
    });
  });
}
