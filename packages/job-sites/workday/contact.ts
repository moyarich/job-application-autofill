import type { Page } from "playwright";
import type { CandidateProfile } from "../../resume/src/types.ts";
import type { AutofillResult } from "../types.ts";
import { findMappedField } from "../core/field-matcher.ts";
import { workdayContactFields } from "./field-map.ts";

/**
 * Contact fields chosen by the Workday adapter, not by the orchestrator.
 * Never overwrite conflicting values or confuse phone numbers with area codes.
 */
export async function fillWorkdayContact(page: Page, profile: CandidateProfile): Promise<AutofillResult> {
  const filled: string[] = [];
  const missing: string[] = [];

  for (const key of workdayContactFields.keys()) {
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
