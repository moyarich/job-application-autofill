import { test, expect } from "@playwright/test";

for (const fails of [false, true]) {
  test(`application deletion ${fails ? "keeps the row when the database rejects it" : "waits for persistence and survives reload"}`, async ({
    page,
  }) => {
    const profileId = "00000000-0000-4000-8000-000000000001";
    const job = {
      id: "00000000-0000-4000-8000-000000000002",
      company: "Example",
      role: "Developer",
      url: "https://example.com/job",
      status: "saved",
      createdAt: "2026-11-09",
      notes: "",
    };
    let jobs = [job];
    let deleting = false;
    let complete!: () => void;
    const pending = new Promise<void>((resolve) => {
      complete = resolve;
    });
    await page.route(
      (url) => url.pathname.startsWith("/api/"),
      async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (request.method() === "DELETE") {
          expect(path).toBe("/api/jobs/" + job.id);
          expect(request.postDataJSON()).toEqual({ revision: 1 });
          deleting = true;
          await pending;
          if (fails)
            return route.fulfill({
              status: 409,
              json: { error: "Application changed. Reload and try again." },
            });
          jobs = [];
          return route.fulfill({ json: { deleted: true } });
        }
        const json =
          path === "/api/profiles"
            ? {
                profiles: [{ id: profileId, name: "Default" }],
                defaultProfileId: profileId,
              }
            : path === "/api/jobs"
              ? { jobs, revisions: { [job.id]: 1 } }
              : { resumes: [], contacts: [] };
        await route.fulfill({ json });
      },
    );
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto("/applications?profile=" + profileId);
    const row = page.locator(".job").filter({ hasText: "Developer" });
    await row.locator("summary").click();
    await row
      .getByRole("button", { name: "Remove Developer at Example" })
      .click();
    await expect.poll(() => deleting).toBe(true);
    await expect(row).toBeVisible();
    await expect(
      row.getByRole("button", { name: "Remove Developer at Example" }),
    ).toBeDisabled();
    complete();
    if (fails) {
      await expect(page.locator(".notice")).toContainText(
        "Application changed. Reload and try again.",
      );
      await expect(row).toBeVisible();
    } else {
      await expect(row).toHaveCount(0);
      await page.reload();
      await expect(
        page.getByText("No applications yet.", { exact: true }),
      ).toBeVisible();
      await expect(row).toHaveCount(0);
    }
  });
}
