import type { Browser } from "playwright";
import { chromium } from "playwright";
import { renderResumeHtml } from "./render-html.ts";
export { renderResumeHtml } from "./render-html.ts";

/**
 * Unicode PDF export is intentionally asynchronous. Chromium shapes complex scripts
 * and embeds available system fonts; no Latin-only renderer or ASCII substitution.
 * Pass launchBrowser in tests to avoid depending on a local Chromium installation.
 */
export async function renderResumePdf(
  input: unknown,
  {
    launchBrowser = () => chromium.launch({ headless: true }),
  }: { launchBrowser?: () => Promise<Browser> } = {},
): Promise<Uint8Array> {
  const html = renderResumeHtml(input);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Uint8Array.from(pdf);
  } finally {
    await browser.close();
  }
}
