import type { Page } from "playwright";
import type { JobSiteAdapter } from "../../types.ts";
import { firstPathTenant } from "../../tenant.ts";

async function openApplication(page: Page) {
  const posting = new URL(page.url());
  const path = posting.pathname.replace(/\/$/, "");
  if (path.endsWith("/apply")) return;
  const application = page
    .locator("a[href$='/apply']")
    .filter({ visible: true })
    .first();
  const href = await application.getAttribute("href", { timeout: 5000 });
  if (!href) return;
  const target = new URL(href, posting);
  if (target.origin === posting.origin && target.pathname === path + "/apply")
    await page.goto(target.href, { waitUntil: "domcontentloaded" });
}

// Lever adapter.
export default {
  id: "lever",
  label: "Lever",
  hosts: ["lever.co"],
  employerTenant: firstPathTenant,
  openApplication,
} satisfies JobSiteAdapter;
