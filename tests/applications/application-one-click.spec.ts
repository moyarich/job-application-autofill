import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("Apply starts the selected employer application without a second click", async ({ page, context }) => {
  const profileId = "00000000-0000-4000-8000-000000000001";
  const resumeId = "00000000-0000-4000-8000-000000000002";
  const contactId = "00000000-0000-4000-8000-000000000003";
  const jobId = "00000000-0000-4000-8000-000000000004";
  const profile = JSON.parse(readFileSync("packages/resume/src/resume-schema/resume.example.json", "utf8"));
  const job = { id: jobId, company: "Example", role: "Developer", url: "https://example.com/jobs/42", resumeId, accountAction: "signup", status: "saved", createdAt: "2026-11-09", notes: "" };
  let starts = 0;
  await context.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path === "/api/profiles") json = { profiles: [{ id: profileId, name: "Default" }], defaultProfileId: profileId };
    else if (path === "/api/resumes") json = { resumes: [{ id: resumeId, name: "Selected resume", contactId }] };
    else if (path === "/api/profile-contacts") json = { contacts: [{ ...profile.contact, id: contactId, name: "Contact", isDefault: true }] };
    else if (path.endsWith("/content")) json = { profile, revision: 1, contactId };
    else if (path === "/api/jobs") json = { jobs: [job], revisions: { [jobId]: 1 } };
    else if (path === "/api/apply/active") json = { session: null };
    else if (path === "/api/resume/pdf") json = { base64: Buffer.from("%PDF-1.4").toString("base64") };
    else if (path === "/api/apply/prepare") {
      starts++;
      expect(route.request().headers()["x-resume-id"]).toBe(resumeId);
      json = { id: "session", jobId, state: "ready_for_review", message: "Ready", url: job.url, reviewUrl: null, filled: [], missing: [], questions: [] };
    }
    await route.fulfill({ json });
  });
  await page.goto(`/applications?profile=${profileId}&resume=${resumeId}`);
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  const popup = await popupPromise;
  await expect(popup.getByRole("heading", { name: "Application review", exact: true })).toBeVisible();
  await expect(popup.getByRole("button", { name: "Open employer application" })).toHaveCount(0);
  expect(starts).toBe(1);
});
