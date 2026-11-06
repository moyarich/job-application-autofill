import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createApplication } from "../packages/job-application-autofill/src/index";

test("application pages use separate UUIDs and restore only their own session", async ({ context, page }) => {
  const profile = JSON.parse(readFileSync("packages/resume/src/resume-schema/resume.example.json", "utf8"));
  const jobs = [createApplication("Example A", "Engineer A", "https://jobs.lever.co/example/a"), createApplication("Example B", "Engineer B", "https://boards.greenhouse.io/example/jobs/123")];
  const sessions = new Map<string, object>();
  await context.route("**/api/**", async route => {
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
