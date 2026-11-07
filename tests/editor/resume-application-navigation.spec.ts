import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("switching resumes stays in the editor and applications retain selected resume", async ({
  page,
  context,
}) => {
  const template = JSON.parse(
    readFileSync("packages/resume/src/resume-schema/resume.example.json", "utf8"),
  );
  const profileId = "00000000-0000-4000-8000-000000000001";
  const first = "00000000-0000-4000-8000-000000000002";
  const second = "00000000-0000-4000-8000-000000000003";
  const versions = [
    { id: first, name: "First resume" },
    { id: second, name: "Second resume" },
  ].map((item) => ({
    ...item,
    contactId: null,
    createdAt: "2026-11-06T00:00:00Z",
    updatedAt: "2026-11-06T00:00:00Z",
  }));
  const profiles = {
    [first]: { ...template, summary: "First resume content" },
    [second]: { ...template, summary: "Second resume content" },
  };
  await context.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      const resumeId = request.headers()["x-resume-id"] || first;
      let json: unknown = {};
      if (pathname === "/api/profiles")
        json = {
          profiles: [{ id: profileId, name: "Default", createdAt: "2026-11-06" }],
          defaultProfileId: profileId,
        };
      else if (pathname === "/api/state" && request.method() === "PUT")
        json = { revision: 2 };
      else if (pathname === "/api/state")
        json = {
          revision: 1,
          profile: profiles[resumeId as keyof typeof profiles],
          contact: template.contact,
          contactId: null,
          defaultContactId: null,
          contacts: [],
          jobs: [],
          resumeId,
          resumes: versions,
        };
      await route.fulfill({ json });
    },
  );

  await page.goto("/resumes/edit?profile=" + profileId + "&resume=" + first);
  await expect(page.getByRole("heading", { name: "Resume editor" })).toBeVisible();
  await page.getByLabel("Resume version").selectOption(second);
  await expect(page).toHaveURL(new RegExp("/resumes/edit\\?profile=" + profileId + "&resume=" + second));
  await expect(page.getByRole("heading", { name: "Resume editor" })).toBeVisible();

  await page.getByRole("link", { name: "Applications", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/applications\\?profile=" + profileId + "&resume=" + second));
  await expect(page.getByRole("heading", { name: "Applications", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Resumes", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/resumes\\?profile=" + profileId + "&resume=" + second));
  await expect(page.getByRole("heading", { name: "Resumes", exact: true }).first()).toBeVisible();
});
