import { test, expect } from "@playwright/test";

for (const fails of [false, true]) {
  test(`navigation ${fails ? "stays on the page if saving fails" : "waits for the latest application edit"}`, async ({ page }) => {
    const profileId = "00000000-0000-4000-8000-000000000001";
    const job = { id: "00000000-0000-4000-8000-000000000002", company: "Example", role: "Developer", url: "https://example.com/job", status: "saved", createdAt: "2026-11-09", notes: "" };
    let began = false;
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (request.method() === "PUT") {
        began = true;
        expect(request.postDataJSON().job.status).toBe("in_progress");
        await pending;
        return route.fulfill(fails ? { status: 500, json: { error: "Save failed" } } : { json: { revision: 2 } });
      }
      const json = path === "/api/profiles" ? { profiles: [{ id: profileId, name: "Default" }], defaultProfileId: profileId }
        : path === "/api/jobs" ? { jobs: [job], revisions: { [job.id]: 1 } } : { resumes: [], contacts: [] };
      return route.fulfill({ json });
    });
    await page.goto("/applications?profile=" + profileId);
    await page.locator(".job summary").click();
    await page.getByLabel("Status for Example Developer").selectOption("in_progress");
    await page.getByRole("link", { name: "Resumes", exact: true }).click();
    await expect.poll(() => began).toBe(true);
    await expect(page).toHaveURL(/\/applications\?/);
    finish();
    if (fails) {
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(page).toHaveURL(/\/applications\?/);
    } else await expect(page).toHaveURL(/\/resumes\?/);
  });
}
