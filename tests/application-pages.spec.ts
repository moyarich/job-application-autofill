import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createApplication } from "../packages/job-application-autofill/src/index";

test("application pages use separate UUIDs and restore only their own session", async ({ context, page }) => {
  const profile = JSON.parse(readFileSync("packages/resume/src/resume-schema/resume.example.json", "utf8"));
  const jobs = [createApplication("Example A", "Engineer A", "https://jobs.lever.co/example/a"), createApplication("Example B", "Engineer B", "https://boards.greenhouse.io/example/jobs/123")];
  const sessions = new Map<string, object>();
  await context.route(url => url.pathname.startsWith("/api/"), async route => {
    const request = route.request(); const url = new URL(request.url());
    let body: unknown = {};
    if (url.pathname === "/api/state") body = {revision: 1, profile, jobs};
    else if (url.pathname === "/api/apply/active") body = {session: sessions.get(url.searchParams.get("jobId") || "") || null};
    else if (url.pathname === "/api/resume/pdf") body = {base64: Buffer.from("%PDF-1.4 test fixture").toString("base64")};
    else if (url.pathname === "/api/apply/prepare") {
      const { jobId, jobUrl } = request.postDataJSON();
      body = {id: jobId, jobId, state:"login_required", url:jobUrl, message:"Sign in for " + jobs.find(job => job.id === jobId)?.company, filled:[], missing:[], reviewUrl:null};
      sessions.set(jobId, body as object);
    } else if (url.pathname.endsWith("/status")) body = {revision:2};
    await route.fulfill({json: body});
  });
  await page.goto("/");
  await expect(page.getByRole("button",{name:"Apply",exact:true})).toHaveCount(2);
  const firstWait = context.waitForEvent("page");
  await page.getByRole("button",{name:"Apply",exact:true}).nth(0).click();
  const first = await firstWait;
  await expect(first).toHaveURL(new RegExp(jobs[0].id));
  await expect(first.getByText("Sign in for Example A").first()).toBeVisible();
  const secondWait = context.waitForEvent("page");
  await page.getByRole("button",{name:"Apply",exact:true}).nth(1).click();
  const second = await secondWait;
  await expect(second).toHaveURL(new RegExp(jobs[1].id));
  await expect(second.getByText("Sign in for Example B").first()).toBeVisible();
  await first.reload();
  await expect(first.getByText("Sign in for Example A").first()).toBeVisible();
  await expect(first.getByText("Sign in for Example B")).toHaveCount(0);
});

test("viewer uses the configured VNC password without putting it in the URL or storage", async ({ page }) => {
  await page.route("**/api/viewer/config", route => route.fulfill({json:{password:"test-viewer-password"}}));
  await page.route("**/api/apply/*/focus", route => route.fulfill({json:{}}));
  await page.route("**/vnc/core/rfb.js", route => route.fulfill({contentType:"text/javascript",body:`
    export default class RFB extends EventTarget {
      constructor(target,url,options) {
        super();
        if(options.credentials.password !== 'test-viewer-password') throw new Error('Missing configured password');
        target.textContent='Authenticated viewer';
        setTimeout(()=>this.dispatchEvent(new Event('connect')),0);
      }
      disconnect() {}
    }
  `}));
  await page.goto("/application-viewer.html?session=aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa");
  await expect(page.getByRole("status")).toHaveText("Connected to application browser");
  expect(page.url()).not.toContain("password");
  expect(await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}))).not.toContain("test-viewer-password");
});

test("normal paste forwards native clipboard text without a fallback panel", async ({ page }) => {
  await page.route("**/api/viewer/config", route=>route.fulfill({json:{password:"test-password"}}));
  await page.route("**/api/apply/*/focus", route=>route.fulfill({json:{}}));
  await page.route("**/vnc/core/rfb.js", route=>route.fulfill({contentType:"text/javascript",body:`
    export default class RFB extends EventTarget {
      constructor(target) {super();this.target=target;setTimeout(()=>this.dispatchEvent(new Event('connect')),0);}
      clipboardPasteFrom(text) {this.text=text;}
      sendKey(key) {if(key===118)this.target.textContent='Remote paste: '+this.text; if(key===99)this.dispatchEvent(new CustomEvent('clipboard',{detail:{text:'Copied remote text'}}));}
      focus() {}
      disconnect() {}
    }
  `}));
  await page.goto("/application-viewer.html?session=aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa");
  await expect(page.getByRole("status")).toHaveText("Connected to application browser");
  await page.locator("#screen").evaluate(element=>element.dispatchEvent(new KeyboardEvent('keydown',{key:'v',metaKey:true,bubbles:true})));
  await expect(page.locator("#paste-input")).toBeFocused();
  await page.locator("#paste-input").evaluate(element=>{
    const clipboardData=new DataTransfer();
    clipboardData.setData('text/plain','Pasted text\nwith another line');
    element.dispatchEvent(new ClipboardEvent('paste',{clipboardData,bubbles:true,cancelable:true}));
  });
  await expect(page.locator("#screen")).toHaveText("Remote paste: Pasted text\nwith another line");
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.locator("#paste-input")).toHaveValue("");
});

test("viewer restores keyboard input after connecting and after returning focus", async ({ page }) => {
  await page.route("**/api/viewer/config", route => route.fulfill({json:{password:"test-password"}}));
  await page.route("**/api/apply/*/focus", async route => {
    await new Promise(resolve => setTimeout(resolve, 150));
    await route.fulfill({json:{}});
  });
  await page.route("**/vnc/core/rfb.js", route => route.fulfill({contentType:"text/javascript",body:`
    export default class RFB extends EventTarget {
      constructor(target) {
        super(); this.target=target; this.viewOnly=false; this.focusCount=0;
        window.__rfbForTest=this;
        setTimeout(()=>this.dispatchEvent(new Event('connect')),0);
      }
      focus() {this.focusCount++;}
      disconnect() {}
    }
  `}));
  await page.goto("/application-viewer.html?session=aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa");
  await expect(page.getByRole("status")).toHaveText("Connected to application browser");
  await expect.poll(() => page.evaluate(() => (window as any).__rfbForTest?.focusCount)).toBeGreaterThan(0);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  expect(await page.evaluate(() => (window as any).__rfbForTest.viewOnly)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  // The API request is still pending; input must not become stuck in view-only mode.
  await page.locator("#screen").click();
  await expect.poll(() => page.evaluate(() => (window as any).__rfbForTest.viewOnly)).toBe(false);
  await expect.poll(() => page.evaluate(() => (window as any).__rfbForTest.focusCount)).toBeGreaterThan(1);
});

test("viewer forwards remote copy to the local clipboard", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {writeText: async (text: string) => { (window as any).__copiedText = text; }},
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
  await expect.poll(() => page.evaluate(() => (window as any).__copiedText)).toBe("Copied remote text");
});
