import { test, expect } from "@playwright/test";

test("an empty library can start a PDF, Word, or JSON import", async ({ page }) => {
  let created = false;
  const resume = { id: "imported", name: "Engineering", contactId: null,
    createdAt: "2026-11-09", updatedAt: "2026-11-09" };
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path === "/api/profiles") {
      json = { profiles: [{ id: "default", name: "Default" }], defaultProfileId: "default" };
    } else if (path === "/api/resumes" && route.request().method() === "POST") {
      expect(route.request().postDataJSON().name).toBe("Engineering");
      created = true;
      json = resume;
    } else if (path === "/api/resumes") {
      json = { resumes: created ? [resume] : [] };
    } else if (path === "/api/profile-contacts") {
      json = { contacts: [] };
    } else if (path.endsWith("/content")) {
      json = { revision: 0, profile: null, contactId: null };
    }
    await route.fulfill({ json });
  });
  await page.goto("/resumes?profile=default");
  await page.getByRole("button", { name: "Import resume", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Start your resume import" })).toBeVisible();
  expect(created).toBe(false);
  await page.getByLabel("Resume name").fill("Engineering");
  await page.getByRole("button", { name: "Continue to import" }).click();
  await expect(page.getByRole("button", { name: "Browse files" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import resume JSON" })).toBeVisible();
  await page.locator('input[type="file"][accept^=".pdf"]').setInputFiles({
    name: "resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4"),
  });
  await expect(page.getByRole("button", { name: "Import resume", exact: true })).toBeEnabled();
  await expect(page.getByText("resume.pdf", { exact: true }).first()).toBeVisible();
});
