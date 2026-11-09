import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createApplication } from "../../packages/job-application-autofill/src/index";

test("application pages use separate UUIDs and restore only their own session", async ({
  context,
  page,
}) => {
  const profile = JSON.parse(
    readFileSync(
      "packages/resume/src/resume-schema/resume.example.json",
      "utf8",
    ),
  );
  const jobs = [
    createApplication(
      "Example A",
      "Engineer A",
      "https://jobs.lever.co/example/a",
    ),
    createApplication(
      "Example B",
      "Engineer B",
      "https://boards.greenhouse.io/example/jobs/123",
    ),
  ];
  const sessions = new Map<string, object>();
  const personId = "00000000-0000-4000-8000-000000000001";
  const resumeId = "00000000-0000-4000-8000-000000000002";
  const contactId = "00000000-0000-4000-8000-000000000003";
  await context.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      let body: unknown = {};
      if (url.pathname === "/api/profiles")
        body = {
          profiles: [
            {
              id: personId,
              name: "Default profile",
              createdAt: "2026-11-06T00:00:00Z",
            },
          ],
          defaultProfileId: personId,
        };
      else if (url.pathname === "/api/resumes")
        body = { resumes: [{
          id: resumeId, name: "Primary resume", contactId,
          createdAt: "2026-11-06T00:00:00Z",
          updatedAt: "2026-11-06T00:00:00Z",
        }] };
      else if (url.pathname === "/api/resumes/" + resumeId + "/content")
        body = { revision: 1, profile, contactId, resumeId };
      else if (url.pathname === "/api/profile-contacts")
        body = { contacts: [{
          ...profile.contact, id: contactId, profileId: personId,
          name: "Primary contact", isDefault: true,
        }] };
      else if (url.pathname === "/api/jobs")
        body = { revision: 1, jobs };
      else if (url.pathname === "/api/apply/active")
        body = {
          session: sessions.get(url.searchParams.get("jobId") || "") || null,
        };
      else if (url.pathname === "/api/resume/pdf")
        body = {
          base64: Buffer.from("%PDF-1.4 test fixture").toString("base64"),
        };
      else if (url.pathname === "/api/apply/prepare") {
        const { jobId, jobUrl } = request.postDataJSON();
        body = {
          id: jobId,
          jobId,
          state: "login_required",
          url: jobUrl,
          message:
            "Sign in for " + jobs.find((job) => job.id === jobId)?.company,
          filled: [],
          missing: [],
          reviewUrl: null,
        };
        sessions.set(jobId, body as object);
      } else if (url.pathname.endsWith("/status")) body = { revision: 2 };
      await route.fulfill({ json: body });
    },
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toHaveCount(2);
  const firstWait = context.waitForEvent("page");
  await page.locator("article.job").filter({ hasText: "Example A" })
    .getByRole("button", { name: "Apply", exact: true }).click();
  const first = await firstWait;
  await expect(first).toHaveURL(new RegExp(jobs[0].id));
  await expect(first.getByText("Sign in for Example A").first()).toBeVisible();
  await expect(
    first.getByRole("heading", { name: "Add an opportunity" }),
  ).toHaveCount(0);
  const secondWait = context.waitForEvent("page");
  await page.locator("article.job").filter({ hasText: "Example B" })
    .getByRole("button", { name: "Apply", exact: true }).click();
  const second = await secondWait;
  await expect(second).toHaveURL(new RegExp(jobs[1].id));
  await expect(second.getByText("Sign in for Example B").first()).toBeVisible();
  await first.reload();
  await expect(first.getByText("Sign in for Example A").first()).toBeVisible();
  await expect(first.getByText("Sign in for Example B")).toHaveCount(0);
});

test("a restored preparing session updates without reopening the employer browser", async ({
  context,
  page,
}) => {
  const profile = JSON.parse(
    readFileSync(
      "packages/resume/src/resume-schema/resume.example.json",
      "utf8",
    ),
  );
  const person = "00000000-0000-4000-8000-000000000001",
    resume = "00000000-0000-4000-8000-000000000002";
  const job = createApplication(
    "Workday",
    "Engineer",
    "https://workday.wd5.myworkdayjobs.com/job/123",
  );
  const sessionId = "00000000-0000-4000-8000-000000000003";
  let preparations = 0;
  await context.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      let json: unknown = {};
      if (path === "/api/profiles")
        json = {
          profiles: [{ id: person, name: "Default", createdAt: "2026-11-06" }],
          defaultProfileId: person,
        };
      if (path === "/api/resumes")
        json = { resumes: [{
          id: resume, name: "Resume", contactId: null,
          createdAt: "2026-11-06", updatedAt: "2026-11-06",
        }] };
      if (path === "/api/resumes/" + resume + "/content")
        json = { revision: 1, profile, contactId: null, resumeId: resume };
      if (path === "/api/profile-contacts")
        json = { contacts: [] };
      if (path === "/api/jobs")
        json = { revision: 1, jobs: [job] };
      if (path === "/api/apply/active")
        json = {
          session: {
            id: sessionId,
            jobId: job.id,
            state: "preparing",
            url: job.url,
            filled: [],
            missing: [],
          },
        };
      if (path === "/api/apply/" + sessionId)
        json = {
          id: sessionId,
          jobId: job.id,
          state: "login_required",
          url: job.url,
          message: "Restored sign-in",
          filled: [],
          missing: [],
        };
      if (path === "/api/apply/prepare") preparations++;
      await route.fulfill({ json });
    },
  );
  await page.goto("/apply/" + job.id);
  await expect(
    page.getByText("Restored sign-in", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Add an opportunity" }),
  ).toHaveCount(0);
  expect(preparations).toBe(0);
});
