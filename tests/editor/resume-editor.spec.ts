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
      if (path === "/api/resume/pdf")
        body = { base64: Buffer.from("%PDF-1.4 test").toString("base64") };
      await route.fulfill({ json: body });
    },
  );
  await page.goto("/resume/edit?resume=" + resumeId);
  await expect(page).toHaveURL(
    new RegExp("/resumes/edit\\?resume=" + resumeId),
  );
  await expect(
    page.getByRole("heading", { name: "Resume editor", exact: true }),
  ).toBeVisible();
  const skillsEditor = page.getByRole("textbox", {
    name: "Skills (comma-separated)",
    exact: true,
  });
  await skillsEditor.fill("React,");
  await expect(skillsEditor).toHaveValue("React,");
  await expect.poll(() => profile.skills).toEqual(["React"]);
  await skillsEditor.press("End");
  await skillsEditor.type(" AWS, TypeScript");
  await expect(skillsEditor).toHaveValue("React, AWS, TypeScript");
  await expect
    .poll(() => profile.skills)
    .toEqual(["React", "AWS", "TypeScript"]);
  await expect(page.getByLabel("Institution", { exact: true })).toHaveValue(
    "DeVry University",
  );
  await expect(page.getByLabel("Certification name")).toHaveValue(
    "AWS Certified Solutions Architect – Associate",
  );
  await expect(
    page.getByLabel("Section content", { exact: true }).first(),
  ).toHaveText(/94,000/);
  await page
    .getByLabel("Institution", { exact: true })
    .fill("Updated University");
  await page
    .getByLabel("Section content", { exact: true })
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
  const summary = page.getByRole("textbox", {
    name: "Resume-specific professional summary",
    exact: true,
  });
  await summary.fill("Builds reliable software");
  await summary.press("ControlOrMeta+a");
  await page
    .locator("#resume-summary")
    .getByRole("button", { name: "Bold", exact: true })
    .click();
  await expect.poll(() => profile.summary).toBe("**Builds reliable software**");
  expect(profile).not.toHaveProperty("richText");
  await expect(summary.locator("strong")).toHaveText(
    "Builds reliable software",
  );

  await expect.poll(() => profile.projects[0]?.name).toBe("Portfolio project");
  await expect
    .poll(() => profile.education[0].institution)
    .toBe("Updated University");
  await page.reload();
  await expect(
    page
      .getByRole("textbox", {
        name: "Resume-specific professional summary",
        exact: true,
      })
      .locator("strong"),
  ).toHaveText("Builds reliable software");
  await expect(page.getByLabel("Institution", { exact: true })).toHaveValue(
    "Updated University",
  );
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Portfolio project",
  );
  await expect(page.getByLabel("Languages (one per line)")).toHaveValue(
    "English\nFrench",
  );
  await expect(
    page.getByLabel("Section content", { exact: true }).first(),
  ).toHaveText("Updated community leadership");
  await page
    .locator("#resume-summary")
    .getByRole("button", { name: "Markdown", exact: true })
    .click();
  await page
    .getByRole("textbox", {
      name: "Resume-specific professional summary Markdown",
      exact: true,
    })
    .fill("Builds **reliable** software");
  await page
    .locator("#resume-summary")
    .getByRole("button", { name: "Rich text", exact: true })
    .click();
  await expect(
    page
      .getByRole("textbox", {
        name: "Resume-specific professional summary",
        exact: true,
      })
      .locator("strong"),
  ).toHaveText("reliable");
  for (const format of ["md", "txt"]) {
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByLabel("Download resume format", { exact: true })
      .selectOption(format);
    const download = await downloadPromise;
    const contents = readFileSync((await download.path())!, "utf8");
    expect(contents).toContain(
      format === "md"
        ? "Builds **reliable** software"
        : "Builds reliable software",
    );
    expect(download.suggestedFilename()).toBe("Primary-resume." + format);
  }
  await page
    .getByRole("link", { name: "Profile & contacts", exact: true })
    .click();
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
  await page.getByRole("link", { name: "Resumes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Resumes", exact: true }).first(),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/resumes(?:[?#]|$)/);
  await page
    .getByLabel("Search resumes", { exact: true })
    .fill("no matching resume");
  await expect(
    page.getByText("No resumes found", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search resumes", { exact: true }).fill("");
  await page.getByRole("link", { name: "Import resume", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes\/import/);
  await expect(
    page.getByRole("link", { name: "Import resume", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("link", { name: "Resumes", exact: true }),
  ).not.toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Resumes", exact: true }).click();
  await page.screenshot({ path: "/tmp/resume-listing.png", fullPage: true });
  const formats = page.getByLabel("Export Primary resume", { exact: true });
  for (const format of ["txt", "yaml", "json", "pdf", "docx", "md"]) {
    const pendingDownload = page.waitForEvent("download");
    await formats.selectOption(format);
    const file = await pendingDownload;
    expect(file.suggestedFilename()).toBe("Primary-resume." + format);
    const contents = readFileSync((await file.path())!);
    if (format === "docx") {
      expect(contents.subarray(0, 2).toString()).toBe("PK");
      await file.saveAs("/tmp/resume-word-export.docx");
    }
    if (format === "yaml")
      expect(contents.toString()).toContain(
        "summary: Builds **reliable** software",
      );
    if (format === "json")
      expect(JSON.parse(contents.toString()).summary).toBe(
        "Builds **reliable** software",
      );
  }
  await page.getByRole("button", { name: "View", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes\/view/);
  await expect(
    page
      .frameLocator('iframe[title="Resume preview"]')
      .getByText("Builds reliable software", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page).toHaveURL(/\/resumes\/edit/);
  await expect(
    page.getByRole("heading", { name: "Resume editor", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Portfolio project",
  );
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

test("View and Export use the chosen row without changing the active resume", async ({
  page,
  context,
}) => {
  const template = JSON.parse(
    readFileSync(
      "packages/resume/src/resume-schema/resume.example.json",
      "utf8",
    ),
  );
  const profileId = "00000000-0000-4000-8000-000000000001";
  const first = "00000000-0000-4000-8000-000000000002",
    second = "00000000-0000-4000-8000-000000000003";
  const profiles = {
    [first]: { ...template, summary: "First resume content" },
    [second]: { ...template, summary: "Second **resume** content" },
  };
  const resumes = [
    { id: first, name: "First resume" },
    { id: second, name: "Second resume" },
  ].map((item) => ({
    ...item,
    contactId: null,
    createdAt: "2026-11-06T00:00:00Z",
    updatedAt: "2026-11-06T00:00:00Z",
  }));
  await context.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      const id = request.headers()["x-resume-id"] || first;
      let json: unknown = {};
      if (path === "/api/profiles")
        json = {
          profiles: [
            { id: profileId, name: "Default", createdAt: "2026-11-06" },
          ],
          defaultProfileId: profileId,
        };
      if (path === "/api/state")
        json = {
          revision: 1,
          profile: profiles[id as keyof typeof profiles],
          contact: template.contact,
          contactId: null,
          defaultContactId: null,
          contacts: [],
          jobs: [],
          resumeId: id,
          resumes,
        };
      await route.fulfill({ json });
    },
  );
  await page.goto("/resumes");
  const row = page
    .locator("article")
    .filter({ has: page.getByText("Second resume", { exact: true }) });
  const pending = page.waitForEvent("download");
  await row
    .getByRole("combobox", { name: "Export Second resume", exact: true })
    .selectOption("json");
  const file = await pending;
  expect(JSON.parse(readFileSync((await file.path())!, "utf8")).summary).toBe(
    "Second **resume** content",
  );
  await expect(page).toHaveURL(/\/resumes$/);
  await row.getByRole("button", { name: "View", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("resume=" + second));
  await expect(
    page
      .frameLocator('iframe[title="Resume preview"]')
      .getByText("Second resume content", { exact: true }),
  ).toBeVisible();
});
