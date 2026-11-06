import type { Page } from "playwright";
import type { CandidateProfile } from "../../resume/src/types.ts";
import type { ContactField } from "../types.ts";
import { adapterForUrl } from "../index.ts";

/** Shared contact strategy; provider-specific field selectors take precedence. */
async function fill(page: Page, names: RegExp[], value: string) {
  if (!value || !String(value).trim()) return false;
  for (const name of names) {
    for (const locator of [
      page.getByLabel(name, { exact: false }),
      page.getByPlaceholder(name, { exact: false }),
    ]) {
      try {
        const target = locator.first();
        if (
          (await target.isVisible({ timeout: 350 })) &&
          (await target.isEnabled())
        ) {
          if (await target.evaluate((element) => element.tagName === "SELECT"))
            await target.selectOption(
              { label: String(value) },
              { timeout: 2500 },
            );
          else if (
            (await target.getAttribute("role")) === "combobox" ||
            (await target.getAttribute("aria-haspopup")) === "listbox"
          ) {
            await target.click({ timeout: 2500 });
            await target.fill(String(value), { timeout: 1000 }).catch(() => {});
            await page
              .getByRole("option", { name: String(value), exact: true })
              .click({ timeout: 2500 });
          } else await target.fill(String(value), { timeout: 2500 });
          return true;
        }
      } catch {
        /* Unsupported or hidden control: manual review required. */
      }
    }
  }
  return false;
}

export async function fillKnownFields(page: Page, profile: CandidateProfile) {
  const fields: Array<[ContactField, RegExp[]]> = [
    ["firstName", [/first.?name/i]],
    ["lastName", [/last.?name/i]],
    ["email", [/e.?mail/i]],
    ["phone", [/^phone number\s*\*?$/i, /^mobile(?: number)?\s*\*?$/i]],
    ["location", [/^location\s*\*?$/i]],
    ["addressLine1", [/^address line 1\s*\*?$/i, /^street address\s*\*?$/i]],
    ["addressLine2", [/^address line 2\s*\*?$/i]],
    ["city", [/^city\s*\*?$/i]],
    ["state", [/^(?:state|province|state or province)\s*\*?$/i]],
    ["postalCode", [/^(?:postal code|zip(?: code)?)\s*\*?$/i]],
    ["country", [/^country\s*\*?$/i]],
    ["phoneCountryCode", [/^country phone code\s*\*?$/i]],
    ["phoneType", [/^phone device type\s*\*?$/i]],
    ["linkedIn", [/linkedin/i]],
    ["github", [/github/i]],
    ["website", [/website|portfolio/i]],
  ];
  const filled: string[] = [];
  const missing: string[] = [];
  const adapter = adapterForUrl(page.url?.() || "");
  const adapterFields: Partial<Record<ContactField, RegExp[]>> =
    adapter?.fields ?? {};
  if (
    adapterFields.fullName &&
    profile.contact.firstName &&
    profile.contact.lastName
  )
    fields.push(["fullName", adapterFields.fullName]);
  for (const [key, locators] of fields) {
    const value =
      key === "fullName"
        ? [profile.contact.firstName, profile.contact.lastName].join(" ")
        : profile.contact[key];
    if (!value) continue;
    if (adapter?.skipContactField && await adapter.skipContactField(page, key))
      continue;
    ((await fill(page, adapterFields[key] || locators, value))
      ? filled
      : missing
    ).push(key);
  }
  return { filled, missing };
}


