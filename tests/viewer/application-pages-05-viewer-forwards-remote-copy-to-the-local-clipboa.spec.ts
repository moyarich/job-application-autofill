import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createApplication } from "../../packages/job-application-autofill/src/index";

type ViewerTestWindow = Window & {
  __rfbForTest?: { focusCount: number; viewOnly: boolean };
  __copiedText?: string;
};


test("viewer forwards remote copy to the local clipboard", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {writeText: async (text: string) => { (window as ViewerTestWindow).__copiedText = text; }},
    });
  });
  await page.route("**/api/viewer/config", route => route.fulfill({json:{password:"test-password"}}));
  await page.route("**/api/apply/*/focus", route => route.fulfill({json:{}}));
  await page.route("**/vnc/core/rfb.js", route => route.fulfill({contentType:"text/javascript",body:`
    export default class RFB extends EventTarget {
      constructor() {super();setTimeout(()=>this.dispatchEvent(new Event('connect')),0);}
      sendKey(key) {if(key===99)this.dispatchEvent(new CustomEvent('clipboard',{detail:{text:'Copied remote text'}}));}
      focus() {}
      disconnect() {}
    }
  `}));
  await page.goto("/application-viewer.html?session=aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa");
  await expect(page.getByRole("status")).toHaveText("Connected to application browser");
  await page.locator("#screen").evaluate(element => element.dispatchEvent(
    new KeyboardEvent("keydown",{key:"c",metaKey:true,bubbles:true})
  ));
  await expect.poll(() => page.evaluate(() => (window as ViewerTestWindow).__copiedText)).toBe("Copied remote text");
});
