import { test, expect } from "@playwright/test";

test("viewer connects through the session-scoped proxy without receiving an environment password", async ({
  page,
}) => {
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
        if(options.credentials?.password) throw new Error('Browser must not receive VNC password');
        if(!url.includes('session=aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa')) throw new Error('Missing session');
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
