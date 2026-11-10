import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

for (const mode of ["new", "started", "expired"]) {
const started = mode !== "new";
test(mode === "expired" ? "expired sessions are removed without marking the application submitted" : started ? "Continue reopens a started application after its resume was removed" : "Apply starts the selected employer application without a second click", async ({
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
  const job = {
    id: jobId,
    company: "Example",
    role: "Developer",
    url: "https://example.com/jobs/42",
    resumeId: started ? null : resumeId,
    accountAction: "signup",
    status: started ? "in_progress" : "saved",
    createdAt: "2026-11-09",
    notes: "",
  };
  let starts = 0;
  let sessionAlive = true;
  const statusUpdates: unknown[] = [];
  await context.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      let json: unknown = {};
      if (path.endsWith("/status")) statusUpdates.push(route.request().postDataJSON());
      if (path === "/api/profiles")
        json = {
          profiles: [{ id: profileId, name: "Default" }],
          defaultProfileId: profileId,
        };
      else if (path === "/api/resumes")
        json = {
          resumes: [{ id: resumeId, name: "Selected resume", contactId }],
        };
      else if (path === "/api/profile-contacts")
        json = {
          contacts: [
            {
              ...profile.contact,
              id: contactId,
              name: "Contact",
              isDefault: true,
            },
          ],
        };
      else if (path.endsWith("/content"))
        json = { profile, revision: 1, contactId };
      else if (path === "/api/jobs")
        json = { jobs: [job], revisions: { [jobId]: 1 } };
      else if (path === "/api/apply/active") json = { session: started && sessionAlive ? {
        id: "existing-session", jobId, state: "ready_for_review", message: "Review your application.",
        url: job.url, reviewUrl: null, filled: [], missing: [], questions: [],
      } : null };
      else if (path === "/api/resume/pdf")
        json = { base64: Buffer.from("%PDF-1.4").toString("base64") };
      else if (path.endsWith("/close")) { sessionAlive = false; json = { closed: true }; }
      else if (path === "/api/apply/prepare") {
        starts++;
        expect(route.request().headers()["x-resume-id"]).toBe(resumeId);
        json = {
          id: "session",
          jobId,
          state: "ready_for_review",
          message: "Ready",
          url: job.url,
          reviewUrl: null,
          filled: [],
          missing: [],
          questions: [],
        };
      }
      await route.fulfill({ json });
    },
  );
  await page.goto(`/applications?profile=${profileId}&resume=${resumeId}`);
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: started ? "Continue application" : "Apply", exact: true }).click();
  const popup = await popupPromise;
  await expect(
    popup.getByRole("heading", { name: "Application review", exact: true }),
  ).toBeVisible();
  await expect(
    popup.getByRole("button", { name: "Open employer application" }),
  ).toHaveCount(0);
  expect(starts).toBe(started ? 0 : 1);
  if (mode === "expired") {
    sessionAlive = false;
    await expect(popup.locator(".notice")).toContainText("Browser session ended.");
    await expect(popup.getByRole("button", { name: "Close browser session", exact: true })).toHaveCount(0);
    await expect(popup.getByRole("button", { name: "Reopen employer application", exact: true })).toBeVisible();
    expect(starts).toBe(0);
    expect(statusUpdates).toEqual([]);
  } else if (started) {
    await popup.getByRole("button", { name: "Close browser session", exact: true }).click();
    await expect(popup.locator(".notice")).toContainText("Application status is unchanged.");
    await expect(popup.getByRole("button", { name: "Close browser session", exact: true })).toHaveCount(0);
    expect(starts).toBe(0);
    expect(statusUpdates).toEqual([]);
  }
});
}
