import { test, expect } from "@playwright/test";

test("normal paste forwards native clipboard text without a fallback panel", async ({
  page,
}) => {
  let pasted = "";
  await page.route("**/api/apply/*/paste", async (route) => {
    pasted = route.request().postDataJSON().text;
    await route.fulfill({ json: { pasted: true } });
  });
  await page.route("**/api/viewer/config", (route) =>
    route.fulfill({ json: { password: "test-password" } }),
  );
  await page.route("**/api/apply/*/focus", (route) =>
    route.fulfill({ json: {} }),
  );
  await page.route("**/vnc/core/rfb.js*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
    export default class RFB extends EventTarget {
      constructor(target) {super();this.target=target;setTimeout(()=>this.dispatchEvent(new Event('connect')),0);}
      clipboardPasteFrom(text) {this.text=text;}
      sendKey(key) {if(key===118)this.target.textContent='Remote paste: '+this.text; if(key===99)this.dispatchEvent(new CustomEvent('clipboard',{detail:{text:'Copied remote text'}}));}
      focus() {}
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
  await page.locator("#screen").evaluate((element) =>
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "v",
        metaKey: true,
        bubbles: true,
      }),
    ),
  );
  await expect(page.locator("#paste-input")).toBeFocused();
  await page.locator("#paste-input").evaluate((element) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", "Pasted text\nwith another line");
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect.poll(() => pasted).toBe("Pasted text\nwith another line");
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.locator("#paste-input")).toHaveValue("");
  expect(
    await page
      .locator("#paste-input")
      .evaluate((element) => document.activeElement === element),
  ).toBe(false);
});
