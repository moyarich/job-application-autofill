import { it, expect, vi } from "vitest";
import { chromium, type Browser } from "playwright";
import {
  prepareApplication,
  continueApplication,
  closeApplication,
} from "../../packages/job-sites/automation.ts";
import { emptyCandidate } from "../../packages/job-application-autofill/src/index.ts";

it("tries configured login for new employer records and keeps a pending resume until an upload step", async () => {
  vi.stubEnv("RESUME_SITE_HOST", "workday.wd5.myworkdayjobs.com");
  vi.stubEnv("RESUME_SITE_EMAIL", "fixture@example.com");
  vi.stubEnv("RESUME_SITE_PASSWORD", "existing-fixture-password");
  const browser = await chromium.launch({ headless: true });
  const url = "https://workday.wd5.myworkdayjobs.com/en-US/Workday/job/123";
  let page: Awaited<ReturnType<typeof browser.newPage>>;
  const launchBrowser = async () =>
    ({
      newContext: async () => {
        const context = await browser.newContext();
        page = await context.newPage();
        await page.route("**/*", (route) =>
          route.fulfill({
            contentType: "text/html",
            body: `<h1>Sign In</h1><label>Email Address<input id="email"></label><label>Password<input id="password" type="password"></label><button data-automation-id="signInSubmitButton" onclick="document.body.innerHTML='<h1>My Information</h1>'">Sign In</button><button onclick="document.body.innerHTML='<h1>Wrong global button</h1>'">Sign In</button>`,
          }),
        );
        return { newPage: async () => page };
      },
      close: () => browser.close(),
    }) as unknown as Browser;
  let session;
  try {
    session = await prepareApplication({
      jobId: "configured-flow",
      jobUrl: url,
      profile: emptyCandidate,
      resume: { fileName: "resume.pdf", buffer: Buffer.from("%PDF-fixture") },
      accountSetupRequired: true,
      company: "Workday",
      launchBrowser,
    });
    expect(session.state).toBe("ready_for_review");
    expect(await page!.locator("h1").innerText()).toBe("My Information");
    expect(session.missing).toContain("resume");
    await page!.setContent(
      '<h1>Upload your resume</h1><label>Resume<input type="file"></label>',
    );
    const continued = await continueApplication(session.id);
    expect(continued.filled).toContain("resume");
    expect(
      await page!
        .locator('input[type="file"]')
        .evaluate((input) => (input as HTMLInputElement).files?.[0]?.name),
    ).toBe("resume.pdf");
  } finally {
    vi.unstubAllEnvs();
    if (session) await closeApplication(session.id);
    else await browser.close();
  }
}, 30000);
