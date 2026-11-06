import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("all resume sections can be edited and saved, with a separate profile page", async ({
  page,
  context,
}) => {
  let profile = JSON.parse(
    readFileSync("output/pdf/Moya-Richards-corrected.json", "utf8"),
  );
  const personId = "00000000-0000-4000-8000-000000000001";
  const resumeId = "00000000-0000-4000-8000-000000000002";
  const contactId = "00000000-0000-4000-8000-000000000003";
  let revision = 1;
  await context.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      let body: unknown = {};
      if (path === "/api/profiles")
        body = {
          profiles: [
            { id: personId, name: "Moya", createdAt: "2026-11-06T00:00:00Z" },
          ],
          defaultProfileId: personId,
        };
      else if (path === "/api/state" && request.method() === "PUT") {
        profile = request.postDataJSON().profile;
        body = { revision: ++revision };
      } else if (path === "/api/state")
        body = {
          revision,
          profile,
          contact: profile.contact,
          contactId,
          defaultContactId: contactId,
          contacts: [
            {
              ...profile.contact,
              id: contactId,
              profileId: personId,
              name: "Primary contact",
              isDefault: true,
            },
          ],
          jobs: [],
          resumeId,
          resumes: [
            {
              id: resumeId,
              name: "Primary resume",
              contactId,
              createdAt: "2026-11-06T00:00:00Z",
              updatedAt: "2026-11-06T00:00:00Z",
            },
          ],
        };
      await route.fulfill({ json: body });
    },
  );
  await page.goto("/resume");
  await expect(
    page.getByRole("heading", { name: "Resume editor", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Institution", { exact: true })).toHaveValue(
    "DeVry University",
  );
  await expect(page.getByLabel("Certification name")).toHaveValue(
    "AWS Certified Solutions Architect – Associate",
  );
  await expect(page.getByLabel("Section content").first()).toHaveValue(
    /94,000/,
  );
  await page
    .getByLabel("Institution", { exact: true })
    .fill("Updated University");
  await page
    .getByLabel("Section content")
    .first()
    .fill("Updated community leadership");
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Portfolio project");
  await page
    .getByLabel("Technologies (comma-separated)")
    .fill("React, TypeScript");
  await page.getByLabel("Languages (one per line)").fill("English\nFrench");
  await page.getByLabel("Awards (one per line)").fill("Engineering award");
  await expect.poll(() => profile.projects[0]?.name).toBe("Portfolio project");
  await expect
    .poll(() => profile.education[0].institution)
    .toBe("Updated University");
  await page.reload();
  await expect(page.getByLabel("Institution", { exact: true })).toHaveValue(
    "Updated University",
  );
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Portfolio project",
  );
  await expect(page.getByLabel("Languages (one per line)")).toHaveValue(
    "English\nFrench",
  );
  await expect(page.getByLabel("Section content").first()).toHaveValue(
    "Updated community leadership",
  );
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page).toHaveURL(/\/profile/);
  await expect(
    page.getByRole("heading", { name: "Profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Saved contacts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Work experience for this resume" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "moyarich@hotmail.com",
  );
  await page.screenshot({ path: "/tmp/profile-page.png", fullPage: true });
  await page.getByRole("link", { name: "Resume editor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resume editor", exact: true })).toBeVisible();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue("Portfolio project");
  await page.screenshot({ path: "/tmp/resume-editor.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});
