import type { Page, Locator } from "playwright";
import type { CandidateProfile } from "../../../resume/src/types.ts";
import type { AutofillResult } from "../../types.ts";
import type { FieldLocatorConfig } from "./selectors.ts";
import { workdayContactFields } from "./selectors.ts";

/**
 * Contact fields chosen by the Workday adapter, not by the orchestrator.
 * Never overwrite conflicting values or confuse phone numbers with area codes.
 */
export async function fillWorkdayContact(page: Page, profile: CandidateProfile): Promise<AutofillResult> {
  const filled: string[] = [];
  const missing: string[] = [];

  for (const key of Object.keys(workdayContactFields) as (keyof typeof workdayContactFields)[]) {
    const value = profile.contact[key];
    if (!value?.trim()) continue;

    const target = await findMappedField(page, workdayContactFields, key);
    if (!target) {
      missing.push(key);
      continue;
    }
    try {
      const tag = await target.evaluate((node) => node.tagName);
      const current = await target.inputValue();
      if (tag === "SELECT") {
        if (current && current !== value) throw Error("conflicting selection");
        if (!current) await target.selectOption({ label: value }, { timeout: 2000 });
      } else {
        if (current.trim() && current.trim() !== value.trim()) throw Error("conflicting value");
        if (!current.trim()) await target.fill(value, { timeout: 2000 });
      }
      filled.push(key);
    } catch {
      missing.push(key);
    }
  }
  return { filled, missing };
}

/** Contact-local locator resolution; not a cross-provider abstraction. */
export async function findMappedField<Key extends string>(
  page: Page,
  fields: Readonly<Record<Key, FieldLocatorConfig>>,
  key: Key,
): Promise<Locator | null> {
  const config = fields[key];
  if (!config) return null;

  const candidates: Locator[] = [
    ...config.labels.map((label) => page.getByLabel(label, { exact: true })),
    ...(config.selectors ?? []).map((selector) => page.locator(selector)),
  ];
  for (const candidate of candidates) {
    const count = await candidate.count().catch(() => 0);
    if (count > 1) return null; // Ambiguity must be reviewed, not worked around.
    if (count !== 1) continue;
    if (!(await candidate.isVisible().catch(() => false))) continue;
    if (!(await candidate.isEnabled().catch(() => false))) continue;

    const editable = await candidate.evaluate((node) => {
      const tag = node.tagName;
      if (!["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return false;
      if (tag === "INPUT") {
        const input = node as HTMLInputElement;
        if (["hidden", "password", "file", "checkbox", "radio", "submit"].includes(input.type)) return false;
        if (input.readOnly) return false;
      }
      if (tag === "TEXTAREA" && (node as HTMLTextAreaElement).readOnly) return false;
      return true;
    }).catch(() => false);
    if (editable) return candidate;
  }
  return null;
}
