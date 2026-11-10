import { test, expect } from "@playwright/test";

test("rename the selected resume from the editor", async ({ page }) => {
  let resume = {
    id: "draft",
    name: "Original",
    contactId: null,
    createdAt: "2026-11-09",
    updatedAt: "2026-11-09",
  };
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      let json: unknown = {};
      if (path === "/api/profiles")
        json = {
          profiles: [{ id: "default", name: "Default" }],
          defaultProfileId: "default",
        };
      else if (path === "/api/resumes") json = { resumes: [resume] };
      else if (path === "/api/profile-contacts") json = { contacts: [] };
      else if (path.endsWith("/content"))
        json = { revision: 0, profile: null, contactId: null };
      else if (route.request().method() === "PATCH") {
        expect(path).toBe("/api/resumes/draft");
        resume = { ...resume, name: route.request().postDataJSON().name };
        json = resume;
      }
      await route.fulfill({ json });
    },
  );
  await page.goto("/resumes/edit?profile=default&resume=draft");
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(page.getByLabel("Resume name", { exact: true })).toHaveValue(
    "Original",
  );
  await page.getByLabel("Resume name", { exact: true }).fill("Engineering");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(page.getByLabel("Resume name", { exact: true })).toHaveCount(0);
  await expect(
    page.getByLabel("Resume version").locator("option:checked"),
  ).toHaveText("Engineering");
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByLabel("Resume name", { exact: true }).fill("Discarded");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(resume.name).toBe("Engineering");
});
