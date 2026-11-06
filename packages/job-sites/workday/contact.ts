import type { Page } from "playwright";
import type { CandidateProfile } from "../../resume/src/types.ts";
import type { AutofillResult } from "../types.ts";

/**
 * Contact fields chosen by the Workday adapter, not by the orchestrator.
 * Never overwrite conflicting values or confuse phone numbers with area codes.
 */
export async function fillWorkdayContact(page: Page, profile: CandidateProfile): Promise<AutofillResult> {
  const filled: string[] = [];
  const missing: string[] = [];
  const fields = [
    ["firstName", /^first name\s*\*?$/i],
    ["lastName", /^last name\s*\*?$/i],
    ["email", /^e.?mail(?: address)?\s*\*?$/i],
    ["phone", /^phone number\s*\*?$/i],
    ["addressLine1", /^address line 1\s*\*?$/i],
    ["addressLine2", /^address line 2\s*\*?$/i],
    ["city", /^city\s*\*?$/i],
    ["state", /^(?:state|state or province|province)\s*\*?$/i],
    ["postalCode", /^(?:postal code|zip(?: code)?)\s*\*?$/i],
  ] as const;
  for (const [key, label] of fields) {
    const value = profile.contact[key];
    if (!value?.trim()) continue;
    const target = page.getByLabel(label).first();
    if (!(await target.isVisible().catch(() => false))) {
      missing.push(key);
      continue;
    }
    try {
      if (!(await target.isEnabled())) throw Error("disabled");
      const tag = await target.evaluate((node) => node.tagName);
      if (tag === "SELECT") {
        const current = await target.inputValue();
        if (current && current !== value) throw Error("conflicting selection");
        if (!current) await target.selectOption({ label: value }, { timeout: 2000 });
      } else {
        const current = await target.inputValue();
        if (current.trim() && current.trim() !== value.trim()) throw Error("conflicting value");
        if (!current.trim()) await target.fill(value, { timeout: 2000 });
      }
      filled.push(key);
    } catch { missing.push(key); }
  }
  return { filled, missing };
}
