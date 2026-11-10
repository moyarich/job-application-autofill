import type { Page } from "playwright";
import { adapterForUrl, formState } from "../index.ts";
import type { JobSiteAdapter, PageDetection } from "../types.ts";

/** Read-only page recognition. No navigation or form submission is performed. */
export async function detectCurrentPage(
  page: Page,
  adapter: JobSiteAdapter,
  expectedHost: string,
): Promise<PageDetection> {
  const url = page.url();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: "external", url };
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== expectedHost ||
    parsed.username ||
    parsed.password ||
    adapterForUrl(url)?.id !== adapter.id
  ) {
    return { kind: "external", url };
  }
  const text = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).slice(0, 20000);
  const state = formState(text, url);
  // Security challenges override provider-specific detection.
  if (state === "manual_intervention") return { kind: "challenge", url };
  const provider = await adapter.detectPage?.(page, text);
  if (provider) return { kind: provider, url };
  if (state === "login_required") {
    const registration =
      /(?:create[ -]?account|sign[ -]?up|register|registration)/i.test(
        parsed.pathname,
      ) ||
      /(?:^|\n)\s*(?:create (?:an? |your )?account|sign up|register)\s*(?:\n|$)/i.test(
        text,
      );
    return { kind: registration ? "registration" : "sign_in", url };
  }
  return { kind: "application", url };
}
