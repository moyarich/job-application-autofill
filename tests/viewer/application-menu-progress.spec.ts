import { test, expect } from "@playwright/test";

test("employer menu follows automation and page changes without reopening", async ({ page }) => {
  let active = {
    state: "ready_for_review",
    paused: false,
    running: false,
    currentAction: null as string | null,
    message: "Review contact details.",
  };
  let items = [{ id: "contact", label: "Contact autofill", available: true }];
  await page.route("**/api/viewer/config", (route) =>
    route.fulfill({ json: { password: "fixture" } }),
  );
  await page.route("**/api/apply/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/menu")) return route.fulfill({ json: { items } });
    if (path.endsWith("/focus")) return route.fulfill({ json: {} });
    return route.fulfill({ json: active });
  });
  await page.route("**/vnc/core/rfb.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `export default class RFB extends EventTarget {
      constructor() { super(); setTimeout(() => this.dispatchEvent(new Event('connect')), 0); }
      focus() {} disconnect() {}
    }`,
  }));
  await page.goto("/application-viewer.html?session=aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa");
  await page.locator("#menu-handle").click();
  await expect(page.locator("#automation-state")).toHaveText("Ready for review");
  active = { ...active, running: true, currentAction: "Skills autofill", message: "" };
  await expect(page.locator("#automation-state")).toHaveText("Running — Skills autofill");
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Contact autofill", exact: true })).toBeDisabled();
  active = { ...active, running: false, currentAction: null, message: "Review screening questions." };
  items = [{ id: "questions", label: "Screening questions", available: true }];
  await expect(page.getByRole("button", { name: "Screening questions", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Contact autofill", exact: true })).toHaveCount(0);
  await expect(page.locator("#menu-message")).toHaveText("Review screening questions.");
  active = { ...active, state: "paused", paused: true };
  await expect(page.locator("#automation-state")).toHaveText("Paused — browser remains available");
  await expect(page.locator("#menu-list button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
});
