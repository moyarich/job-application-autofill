import { expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import {
  prepareApplication,
  pasteApplicationText,
  closeApplication,
} from "../../packages/job-sites/automation.ts";
import { emptyCandidate } from "../../packages/job-application-autofill/src/index.ts";
it("pastes complete text into a focused field and refuses noneditable or other-host destinations", async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const url = "https://jobs.lever.co/fixture/paste";
  await page.route("**/*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<h1>Sign In</h1><form onsubmit="event.preventDefault();window.submitted()"><input aria-label="Fixture password" type="password"><textarea aria-label="Details"></textarea><button>Submit</button></form>',
    }),
  );
  let submitted = 0;
  await page.exposeFunction("submitted", () => submitted++);
  const launchBrowser = async () =>
    ({
      newContext: async () => ({ newPage: async () => page }),
      close: () => browser.close(),
    }) as unknown as Browser;
  let session;
  try {
    session = await prepareApplication({
      jobId: "paste-fixture",
      jobUrl: url,
      profile: emptyCandidate,
      launchBrowser,
    });
    await expect(
      pasteApplicationText(session.id, "fixture text"),
    ).rejects.toThrow("Select an editable field");
    const field = page.getByLabel("Fixture password");
    await field.focus();
    await pasteApplicationText(session.id, "Test-only-Value-123!_");
    expect(await field.inputValue()).toBe("Test-only-Value-123!_");
    await field.press("ControlOrMeta+a");
    await pasteApplicationText(session.id, "replacement");
    expect(await field.inputValue()).toBe("replacement");
    await page.getByLabel("Details").focus();
    await pasteApplicationText(session.id, "first line\n第二行");
    expect(await page.getByLabel("Details").inputValue()).toBe(
      "first line\n第二行",
    );
    expect(submitted).toBe(0);
    await page.goto("https://outside.example/");
    await expect(
      pasteApplicationText(session.id, "fixture text"),
    ).rejects.toThrow("Return to the employer");
  } finally {
    if (session) await closeApplication(session.id);
    else await browser.close();
  }
}, 15000);
