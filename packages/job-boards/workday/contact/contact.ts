import type { Page, Locator } from "playwright";
import type { CandidateProfile } from "../../../resume/src/types.ts";
import type { AutofillResult } from "../../types.ts";
import type { FieldLocatorConfig } from "./selectors.ts";
import { workdayContactFields } from "./selectors.ts";

const trim = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const empty = (s: string) => !trim(s) || /^(select|select one|choose|select a country)$/i.test(s.trim());

async function chooseExactOption(page: Page, value: string): Promise<boolean> {
  // Workday renders dropdown options in portals outside the button container.
  const candidates = [
    page.getByRole("option", { name: value, exact: true }),
    page.getByRole("listbox").getByText(value, { exact: true }),
    page.locator('[data-automation-id="promptOption"]').getByText(value, { exact: true }),
    page.getByText(value, { exact: true }),
  ];
  for (const candidate of candidates) {
    const count = await candidate.count().catch(() => 0);
    if (count !== 1 || !(await candidate.isVisible().catch(() => false))) continue;
    await candidate.click({ timeout: 2000 });
    return true;
  }
  return false;
}

/** Fill text and native/custom selects, preserving any existing conflicting answer. */
async function fillTarget(page: Page, target: Locator, value: string): Promise<boolean> {
  const tag = await target.evaluate((node) => node.tagName);
  if (tag === "SELECT") {
    const options = await target.locator("option").allTextContents();
    const match = options.find((label) => trim(label) === trim(value));
    if (!match) return false;
    const selected = await target.locator("option:checked").textContent().catch(() => "");
    if (selected && !empty(selected) && trim(selected) !== trim(value)) return false;
    if (trim(selected || "") !== trim(value))
      await target.selectOption({ label: match }, { timeout: 2000 });
    return true;
  }
  if (tag === "BUTTON" || (await target.getAttribute("role")) === "combobox") {
    const current = await target.inputValue().catch(async () =>
      (await target.innerText().catch(() => "")));
    // Workday button names include the control label followed by its selected value.
    if (trim(current).endsWith(trim(value))) return true;
    if (!empty(current) && !/^(country|state|phone device type|phone type|select one required|country \/ territory)/i.test(current))
      return false;
    await target.click({ timeout: 2000 });
    return chooseExactOption(page, value);
  }
  if (tag !== "INPUT" && tag !== "TEXTAREA") return false;
  const current = await target.inputValue();
  if (trim(current) === trim(value)) return true;
  if (!empty(current)) return false;
  await target.fill(value, { timeout: 2000 });
  return true;
}

/** Fill saved profile contact fields; unsupported controls stay on the review checklist. */
export async function fillWorkdayContact(
  page: Page,
  profile: CandidateProfile,
): Promise<AutofillResult> {
  const filled: string[] = [];
  const missing: string[] = [];
  for (const key of Object.keys(workdayContactFields) as (keyof typeof workdayContactFields)[]) {
    const value = profile.contact[key]?.trim();
    if (!value) continue;
    let target = await findMappedField(page, workdayContactFields, key);
    // Workday's country/state/phone selectors are often labelled buttons, not inputs.
    if (!target && ["state", "country", "phoneCountryCode", "phoneType"].includes(key)) {
      const prefix = {
        state: /^state(?:\s|$)/i,
        country: /^country \/ territory(?:\s|$)/i,
        phoneCountryCode: /^country \/ territory phone code(?:\s|$)/i,
        phoneType: /^phone device type(?:\s|$)/i,
      }[key as "state" | "country" | "phoneCountryCode" | "phoneType"];
      for (const label of [prefix]) {
        const button = page.getByRole("button", { name: label });
        if (await button.count() === 1 && await button.isVisible().catch(() => false)) {
          target = button;
          break;
        }
      }
    }
    if (!target) {
      missing.push(key);
      continue;
    }
    try {
      if (await fillTarget(page, target, value)) filled.push(key);
      else missing.push(key);
    } catch {
      missing.push(key);
    }
  }
  return { filled, missing };
}

/** Contact-local locator resolution; ambiguity is reported instead of guessed. */
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
    if (count > 1) return null;
    if (count !== 1 || !(await candidate.isVisible().catch(() => false)) ||
      !(await candidate.isEnabled().catch(() => false))) continue;
    const editable = await candidate.evaluate((node) => {
      if (!["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName)) return false;
      // Tag checks also work with mocked elements and across DOM realms.
      if (node.tagName === "INPUT") {
        const input = node as HTMLInputElement;
        if (["hidden", "password", "file", "checkbox", "radio", "submit"].includes(input.type) ||
            input.readOnly) return false;
      }
      if (node.tagName === "TEXTAREA" && (node as HTMLTextAreaElement).readOnly) return false;
      return true;
    }).catch(() => false);
    if (editable) return candidate;
  }
  return null;
}
