import { test, expect } from "@playwright/test";

for (const width of [1440, 768, 375]) {
  test(`application controls fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
      const path = new URL(route.request().url()).pathname;
      const jobs = Array.from({ length: 12 }, (_, index) => ({
        id: `job-${index}`, company: `Company ${index}`, role: "Engineer",
        status: index === 0 ? "submitted" : "saved",
        createdAt: "2026-11-09T00:00:00Z", url: "", notes: "",
      }));
      const json = path === "/api/profiles"
        ? { profiles: [{ id: "default", name: "Default" }], defaultProfileId: "default" }
        : { revision: 1, profile: {}, jobs, resumes: [], contacts: [] };
      await route.fulfill({ json });
    });
    await page.goto("/applications?profile=default");
    const status = page.getByLabel("Filter applications by status");
    await expect(status).toBeVisible();
    await expect(page.getByText("Showing 1–10 of 12 applications")).toBeVisible();
    await expect(page.locator(".search-input label")).toHaveCSS("position", "absolute");
    await expect(page.locator(".pagination-page-size")).toHaveCSS("flex-direction", "row");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByText("Showing 11–12 of 12 applications")).toBeVisible();
    await status.selectOption("submitted");
    await expect(page.getByText("Showing 1–1 of 1 application", { exact: true })).toBeVisible();
    await page.getByLabel("Search applications", { exact: true }).fill("no match");
    await expect(page.getByText("No matching applications.", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Application pages" })).toHaveCount(0);
  });
}
