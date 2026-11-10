import { test, expect } from "@playwright/test";

test("viewer uses the configured VNC password without putting it in the URL or storage", async ({
  page,
}) => {
  await page.route("**/api/viewer/config", (route) =>
    route.fulfill({ json: { password: "test-viewer-password" } }),
  );
  await page.route("**/api/apply/*/focus", (route) =>
    route.fulfill({ json: {} }),
  );
  await page.route("**/vnc/core/rfb.js*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
    export default class RFB extends EventTarget {
      constructor(target,url,options) {
        super();
        if(options.credentials.password !== 'test-viewer-password') throw new Error('Missing configured password');
        target.textContent='Authenticated viewer';
        setTimeout(()=>this.dispatchEvent(new Event('connect')),0);
      }
      disconnect() {}
    }
  `,
    }),
  );
  await page.goto(
    "/application-viewer?session=aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa",
  );
  await expect(page.getByRole("status")).toHaveText(
    "Connected to application browser",
  );
  expect(page.url()).not.toContain("password");
  expect(
    await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }),
    ),
  ).not.toContain("test-viewer-password");
});
