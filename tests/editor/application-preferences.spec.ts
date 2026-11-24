import { test, expect } from "@playwright/test";
import {
  openStore,
  DEFAULT_PROFILE_ID,
} from "../../packages/resume-api/src/database/store.ts";
import { createApiHandler } from "../../packages/resume-api/src/server/app.ts";

test("creates, views, moves, resizes, selects, edits and deletes reusable preferences", async ({
  page,
  baseURL,
}) => {
  const store = openStore(":memory:");
  const applicationId = "e8796d4c-828e-4634-aa60-ab39bc95e241";
  store.updateJobRecord({
    revision: 0,
    job: {
      id: applicationId,
      company: "Render",
      role: "Engineer",
      url: "https://example.com",
      status: "saved",
      createdAt: "2026-11-18",
      notes: "",
    },
  });
  const handler = createApiHandler(store, { origin: baseURL! });
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request();
      const response = await handler({
        method: request.method(),
        url: new URL(request.url()),
        headers: request.headers(),
        readJson: async () => request.postDataJSON(),
      });
      await route.fulfill({ status: response.status, json: response.body });
    },
  );
  try {
    await page.goto("/application-preferences");
    await page.getByRole("button", { name: "New preference" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill("US remote");
    await dialog.getByLabel("Employment country").selectOption("United States");
    await dialog.getByLabel("Minimum salary").fill("140000");
    await dialog.getByLabel("Maximum salary").fill("180000");
    await dialog.getByLabel("Salary period").selectOption("Per year");
    await dialog
      .getByRole("group", { name: "Work arrangement", exact: true })
      .getByLabel("Remote", { exact: true })
      .check();
    await dialog
      .getByRole("group", { name: "Work arrangement", exact: true })
      .getByLabel("Hybrid", { exact: true })
      .check();
    await dialog
      .getByRole("group", { name: "Employment type", exact: true })
      .getByLabel("Full-time", { exact: true })
      .check();
    await dialog
      .getByLabel("Sponsorship requirements")
      .selectOption("Not required");
    const footerBeforeScroll = await dialog.locator("footer").boundingBox();
    const body = dialog.locator(".floating-dialog-body");
    const headerBeforeScroll = await dialog.locator("header").boundingBox();
    await body.hover();
    await page.mouse.wheel(0, 300);
    await expect
      .poll(() => body.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(0);
    expect((await dialog.locator("header").boundingBox())!.y).toBe(
      headerBeforeScroll!.y,
    );
    expect(await dialog.evaluate((node) => node.scrollTop)).toBe(0);
    expect((await dialog.locator("footer").boundingBox())!.y).toBe(
      footerBeforeScroll!.y,
    );
    await dialog.getByRole("button", { name: "Save preference" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "US remote · Default" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "New preference" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill("Canada hybrid");
    await dialog.getByLabel("Employment country").selectOption("Canada");
    await dialog.getByLabel("Salary currency").selectOption("CAD");
    await dialog.getByRole("button", { name: "Save preference" }).click();
    await expect(dialog).toHaveCount(0);
    await page
      .getByLabel("Saved preference")
      .selectOption({ label: "Canada hybrid" });
    await page.getByRole("button", { name: "View selected data" }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Canada", { exact: true })).toBeVisible();
    await expect(dialog.getByText("CAD", { exact: true })).toBeVisible();

    const dragBefore = (await dialog.boundingBox())!;
    const handle = (await dialog.locator("header").boundingBox())!;
    await page.mouse.move(handle.x + 10, handle.y + 10);
    await page.mouse.down();
    await page.mouse.move(handle.x + 70, handle.y + 50, { steps: 5 });
    await page.mouse.up();
    await expect
      .poll(async () => (await dialog.boundingBox())!.x)
      .toBeGreaterThan(dragBefore.x);
    await expect
      .poll(async () => (await dialog.boundingBox())!.y)
      .toBeGreaterThan(dragBefore.y);
    const before = await dialog.boundingBox();
    const heading = dialog.getByRole("heading", { name: "Canada hybrid" });
    await heading.focus();
    await heading.press("ArrowRight");
    await expect
      .poll(async () => (await dialog.boundingBox())!.x)
      .toBeGreaterThan(before!.x);
    // Exercise the native resize grip.
    const current = (await dialog.boundingBox())!;
    await page.mouse.move(
      current.x + current.width - 3,
      current.y + current.height - 3,
    );
    await page.mouse.down();
    await page.mouse.move(
      current.x + current.width + 60,
      current.y + current.height + 40,
    );
    await page.mouse.up();
    await expect
      .poll(async () => (await dialog.boundingBox())!.width)
      .toBeGreaterThan(current.width);
    await dialog.getByRole("button", { name: "Close dialog" }).click();

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Availability notes (optional)").fill("Two weeks");
    await dialog.getByRole("button", { name: "Save preference" }).click();
    await expect(dialog).toHaveCount(0);
    const us = store
      .listApplicationPreferences(DEFAULT_PROFILE_ID)
      .find((p) => p.name === "US remote")!;
    expect(us.data).toMatchObject({
      salaryMinimum: "140000",
      salaryMaximum: "180000",
      salaryPeriod: "Per year",
      workArrangement: "Remote, Hybrid",
      employmentType: "Full-time",
      sponsorship: "Not required",
    });
    const canada = store
      .listApplicationPreferences(DEFAULT_PROFILE_ID)
      .find((p) => p.name === "Canada hybrid")!;
    await page.goto("/apply/" + applicationId);
    await page.getByLabel("Saved preference").selectOption(canada.id);
    await expect(page.getByText("Two weeks", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Saved preference")).toHaveValue(canada.id);
    await expect(page.getByText("CAD", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete preference", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "US remote · Default" }),
    ).toBeVisible();
    expect(
      store.getApplicationPreference(DEFAULT_PROFILE_ID, applicationId)
        .preference?.name,
    ).toBe("US remote");
    const legacy = store.saveApplicationPreference(DEFAULT_PROFILE_ID, null, {
      name: "Existing preference",
      isDefault: false,
      data: {
        country: "US",
        salary: "Market rate",
        availability: "After current project",
        workArrangement: "Remote only",
      },
    });
    await page.goto("/application-preferences");
    await page.getByLabel("Saved preference").selectOption(legacy.id);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Employment country")).toHaveValue("US");
    await expect(dialog.getByLabel("Salary notes (optional)")).toHaveValue(
      "Market rate",
    );
    await expect(
      dialog.getByLabel("Availability notes (optional)"),
    ).toHaveValue("After current project");
    await expect(
      dialog
        .getByRole("group", { name: "Work arrangement", exact: true })
        .getByLabel("Remote only"),
    ).toBeChecked();
    await dialog.getByRole("button", { name: "Save preference" }).click();
    await expect(dialog).toHaveCount(0);
    expect(
      store
        .listApplicationPreferences(DEFAULT_PROFILE_ID)
        .find((p) => p.id === legacy.id)?.data,
    ).toEqual(legacy.data);
    for (const jobBoard of [
      "ashby",
      "greenhouse",
      "lever",
      "smart-recruiters",
      "workday",
    ]) {
      const name = jobBoard + " remote";
      await page.getByRole("button", { name: "New preference" }).click();
      dialog = page.getByRole("dialog");
      await dialog.getByLabel("Name", { exact: true }).fill(name);
      await dialog.getByLabel("Job board").selectOption(jobBoard);
      await dialog.getByLabel("Minimum salary").fill("145000.50");
      await dialog.getByLabel("Remote", { exact: true }).check();
      await dialog.getByRole("button", { name: "Save preference" }).click();
      await expect(dialog).toHaveCount(0);
      const saved = store
        .listApplicationPreferences(DEFAULT_PROFILE_ID)
        .find((preference) => preference.name === name);
      expect(saved).toMatchObject({
        jobBoard,
        data: { salaryMinimum: 145000.5, workArrangement: ["Remote"] },
      });
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      dialog = page.getByRole("dialog");
      await expect(dialog.getByLabel("Job board")).toHaveValue(jobBoard);
      await expect(dialog.getByLabel("Minimum salary")).toHaveValue("145000.5");
      await expect(dialog.getByLabel("Remote", { exact: true })).toBeChecked();
      await dialog.getByRole("button", { name: "Close dialog" }).click();
    }
  } finally {
    store.close();
  }
});
