import { test, expect } from "@playwright/test";

test("employer menu follows automation and page changes without reopening", async ({
  page,
}) => {
  let active = {
    state: "ready_for_review",
    paused: false,
    running: false,
    currentAction: null as string | null,
    message: "Review contact details.",
  };
  let items: {
    id: string;
    label: string;
    available: boolean;
    status?: string;
  }[] = [{ id: "contact", label: "Contact autofill", available: true }];
  let includesSession = false;
  // Model the live progress stream: changing server state alone no longer
  // refreshes the React menu unless the server emits an SSE notification.
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    const encoder = new TextEncoder();
    let publish: (() => void) | undefined;
    (
      window as typeof window & { __emitApplicationUpdate?: () => void }
    ).__emitApplicationUpdate = () => publish?.();
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (!new URL(url, location.href).pathname.endsWith("/events"))
        return originalFetch(input, init);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          publish = () =>
            controller.enqueue(encoder.encode("event: update\ndata: {}\n\n"));
          publish();
          init?.signal?.addEventListener(
            "abort",
            () => {
              publish = undefined;
              controller.close();
            },
            { once: true },
          );
        },
      });
      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    };
  });
  const notify = () =>
    page.evaluate(() =>
      (
        window as typeof window & { __emitApplicationUpdate?: () => void }
      ).__emitApplicationUpdate?.(),
    );
  await page.route("**/api/viewer/config", (route) =>
    route.fulfill({ json: { password: "fixture" } }),
  );
  await page.route("**/api/apply/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/menu"))
      return route.fulfill({
        json: { items, ...(includesSession ? { session: active } : {}) },
      });
    if (path.endsWith("/focus")) return route.fulfill({ json: {} });
    return route.fulfill({
      json: {
        ...active,
        state: "login_required",
        message: "Stale sign-in status",
      },
    });
  });
  await page.route("**/vnc/core/rfb.js*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export default class RFB extends EventTarget {
      constructor() { super(); setTimeout(() => this.dispatchEvent(new Event('connect')), 0); }
      focus() {} disconnect() {}
    }`,
    }),
  );
  await page.goto(
    "/application-viewer.html?session=aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa",
  );
  await expect(page.locator("#site-menu")).toBeVisible();
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const menu = document
            .getElementById("site-menu")!
            .getBoundingClientRect();
          const screen = document
            .getElementById("screen")!
            .getBoundingClientRect();
          return menu.height > 0 && menu.bottom <= screen.top;
        }),
      )
      .toBe(true);
  }
  await page.locator("#menu-handle").click();
  await expect(page.locator("#automation-state")).toHaveText(
    "Ready for review",
  );
  includesSession = true;
  active = {
    ...active,
    running: true,
    currentAction: "Skills autofill",
    message: "",
  };
  await notify();
  await expect(page.locator("#automation-state")).toHaveText(
    "Running — Skills autofill",
  );
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Stop", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Contact autofill", exact: true }),
  ).toBeDisabled();
  await page.locator("#menu-handle").click();
  await expect(page.locator("#menu-handle")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.locator("#automation-state")).toBeVisible();
  await page.locator("#menu-handle").click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  active = {
    ...active,
    running: false,
    currentAction: null,
    message: "Review screening questions.",
  };
  items = [{ id: "questions", label: "Screening questions", available: true }];
  await notify();
  await expect(
    page.getByRole("button", { name: "Screening questions", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Contact autofill", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("#menu-message")).toHaveText("");
  await expect(page.locator("#menu-next-step")).toHaveText(
    "Fill Screening questions",
  );
  active = { ...active, state: "paused", paused: true };
  await notify();
  await expect(page.locator("#automation-state")).toHaveText(
    "Paused — browser remains available",
  );
  await expect(page.locator("#menu-list button")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Resume autofill", exact: true }),
  ).toBeEnabled();
  active = { ...active, state: "ready_for_review", paused: false };
  items = Array.from({ length: 24 }, (_, i) => ({
    id: `step-${i}`,
    label: `Employer step ${i + 1}`,
    available: i > 1,
    status:
      i === 0
        ? "processed"
        : i === 1
          ? "needs_review"
          : i === 2
            ? "filled"
            : undefined,
  }));
  await notify();
  await page.setViewportSize({ width: 375, height: 480 });
  await expect(page.locator("#menu-list button")).toHaveCount(24);
  await expect(
    page
      .getByRole("button", { name: "Employer step 1", exact: true })
      .locator("small"),
  ).toHaveText("Processed");
  await expect(
    page
      .getByRole("button", { name: "Employer step 2", exact: true })
      .locator("small"),
  ).toHaveText("Needs review");
  await expect(
    page
      .getByRole("button", { name: "Employer step 3", exact: true })
      .locator("small"),
  ).toHaveText("Filled");
  await expect(page.locator("#menu-list .step-status-icon")).toHaveCount(24);
  await expect(page.locator("#menu-summary")).toContainText(
    "2 done · 1 to check",
  );
  await expect(page.locator("#menu-next-step")).toHaveText(
    "Check Employer step 2",
  );
  await expect(page.locator("#menu-footer")).not.toContainText(
    "Automation details",
  );
  await expect(
    page.getByRole("button", { name: "Refresh section status" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.locator("#site-menu").evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.right <= innerWidth &&
          rect.bottom <= innerHeight
        );
      }),
    )
    .toBe(true);
  await page.screenshot({ path: "/tmp/moya-site-menu-mobile.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator("#menu-handle")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
