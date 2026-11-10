import { test, expect } from "@playwright/test";

test("application controls are grouped and secondary actions appear in one menu", async ({ page }) => {
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = path === "/api/profiles"
      ? { profiles: [{ id: "default", name: "Default" }], defaultProfileId: "default" }
      : {
          revision: 1,
          profile: {},
          jobs: [{
            id: "job-1",
            company: "Cardinal Health",
            role: "Senior Engineer",
            status: "in_progress",
            createdAt: "2026-11-09T00:00:00Z",
            url: "https://example.com/job",
            notes: "",
            accountAction: "signup",
            resumeId: null,
            details: { location: "Remote", description: "Build software." },
          }],
          resumes: [],
          contacts: [],
        };
    await route.fulfill({ json });
  });

  await page.goto("/applications?profile=default");

  await expect(page.getByRole("group", { name: "Employer account" })).toHaveCount(0);
  await expect(page.locator("#add-application")).toHaveCount(0);

  const row = page.locator(".job").filter({ hasText: "Senior Engineer" });
  await expect(row.locator(".job-apply-card")).toBeVisible();
  await expect(row.locator(".job-apply-card").getByLabel(/Resume for Senior Engineer/)).toBeVisible();
  await expect(row.locator(".job-apply-card").getByLabel(/Account action for Senior Engineer/)).toBeVisible();
  await expect(row.locator(".job-apply-card").getByRole("button", { name: "Apply" })).toBeVisible();
  await expect(row.getByText("Job description")).toHaveCount(0);

  await row.getByText("Actions", { exact: true }).click();
  const menu = row.locator(".job-action-menu");
  await expect(menu.getByLabel("Status for Cardinal Health Senior Engineer")).toBeVisible();
  await expect(menu.getByRole("button", { name: "Job description" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "View job posting" })).toHaveAttribute("href", "https://example.com/job");
  await expect(menu.getByRole("button", { name: "Notes" })).toBeVisible();
  await expect(menu.getByRole("button", { name: /Remove Senior Engineer/ })).toBeVisible();

  await menu.getByRole("button", { name: "Job description" }).click();
  await expect(row.locator(".job-description-expanded")).toContainText("Build software.");
  await row.getByText("Actions", { exact: true }).click();
  await menu.getByRole("button", { name: "Notes" }).click();
  await expect(row.getByRole("textbox", { name: "Application notes" })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
