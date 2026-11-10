import { test, expect } from "@playwright/test";

type ViewerTestWindow = Window & {
  __rfbForTest?: { focusCount: number; viewOnly: boolean };
  __copiedText?: string;
};

test("viewer restores keyboard input after connecting and after returning focus", async ({
  page,
}) => {
  await page.route("**/api/viewer/config", (route) =>
    route.fulfill({ json: { password: "test-password" } }),
  );
  await page.route("**/api/apply/*/focus", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({ json: {} });
  });
  await page.route("**/vnc/core/rfb.js*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
    export default class RFB extends EventTarget {
      constructor(target) {
        super(); this.target=target; this.viewOnly=false; this.focusCount=0;
        window.__rfbForTest=this;
        setTimeout(()=>this.dispatchEvent(new Event('connect')),0);
      }
      focus() {this.focusCount++;}
      disconnect() {}
    }
  `,
    }),
  );
  await page.goto(
    "/application-viewer.html?session=aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa",
  );
  await expect(page.getByRole("status")).toHaveText(
    "Connected to application browser",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as ViewerTestWindow).__rfbForTest?.focusCount,
      ),
    )
    .toBeGreaterThan(0);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  expect(
    await page.evaluate(
      () => (window as ViewerTestWindow).__rfbForTest?.viewOnly,
    ),
  ).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  // The API request is still pending; input must not become stuck in view-only mode.
  await page.locator("#screen").click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as ViewerTestWindow).__rfbForTest?.viewOnly),
    )
    .toBe(false);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as ViewerTestWindow).__rfbForTest?.focusCount,
      ),
    )
    .toBeGreaterThan(1);
});
