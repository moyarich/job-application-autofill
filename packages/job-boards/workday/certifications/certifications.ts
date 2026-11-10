import type { Locator, Page } from "playwright";
import type { Resume } from "@moyarich/resume";

type Result = { filled: string[]; unresolved: string[] };

const ROW = /^Certification\s+\d+$/i;
const fields = {
  name: /^(certification|certification name|name)\s*\*?$/i,
  issuer: /^(issuing organization|issuer|issued by)\s*\*?$/i,
  issuedDate: /^(issue date|issued date|date issued)\s*\*?$/i,
  expirationDate: /^(expiration date|expiry date|expires on)\s*\*?$/i,
  credentialId: /^(credential id|certificate id)\s*\*?$/i,
  url: /^(credential url|certificate url)\s*\*?$/i,
} as const;

async function visible(locator: Locator) {
  return locator.isVisible().catch(() => false);
}

function exactOption(page: Page, value: string) {
  return page
    .getByRole("option", { name: value, exact: true })
    .or(
      page
        .locator('[data-automation-id="promptOption"]')
        .getByText(value, { exact: true }),
    )
    .or(page.getByRole("listbox").getByText(value, { exact: true }));
}

/** Never replace an employer-provided value or pick an approximate suggestion. */
async function choose(row: Locator, page: Page, label: RegExp, value: string) {
  const field = row.getByLabel(label).first();
  if (!(await visible(field))) return false;
  const tag = await field.evaluate((node) => node.tagName).catch(() => "");
  const old = await field.inputValue().catch(() => null);
  if (old?.trim() === value.trim()) return true;
  if (old?.trim() && !/^(select|select one)$/i.test(old.trim())) return false;
  try {
    if (tag === "SELECT") {
      const option = field.locator("option").filter({ hasText: value });
      const labels = await option.allTextContents();
      if (!labels.some((text) => text.trim() === value)) return false;
      await field.selectOption({ label: value }, { timeout: 2000 });
    } else if (
      tag === "BUTTON" ||
      (await field.getAttribute("role")) === "combobox" ||
      (await field.getAttribute("aria-haspopup"))
    ) {
      await field.click({ timeout: 2000 });
      if (tag === "INPUT") await field.fill(value, { timeout: 2000 });
      const option = exactOption(page, value);
      if ((await option.count()) !== 1 || !(await visible(option)))
        return false;
      await option.click({ timeout: 2000 });
    } else if (tag === "INPUT" || tag === "TEXTAREA") {
      await field.fill(value, { timeout: 2000 });
    } else return false;
    return true;
  } catch {
    return false;
  }
}

/** A year-month cannot safely be converted to an exact calendar day. */
async function setMonth(row: Locator, label: RegExp, date: string) {
  const field = row.getByLabel(label).first();
  if (!(await visible(field))) return false;
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(date)) return false;
  if ((await field.getAttribute("type")) !== "month") return false;
  const old = await field.inputValue().catch(() => null);
  if (old === date) return true;
  if (old) return false;
  return field
    .fill(date, { timeout: 2000 })
    .then(() => true)
    .catch(() => false);
}

export async function workdayCertificationsVisible(
  page: Page,
): Promise<boolean> {
  const rows = page.getByRole("group", { name: ROW });
  for (let i = 0; i < (await rows.count()); i++) {
    if (
      (await visible(rows.nth(i))) &&
      (await visible(rows.nth(i).getByLabel(fields.name).first()))
    )
      return true;
  }
  return false;
}

/** Existing Workday certification cards are filled independently and idempotently. */
export async function fillWorkdayCertifications(
  page: Page,
  certificates: Resume["certifications"],
): Promise<Result> {
  const result: Result = { filled: [], unresolved: [] };
  if (!certificates.length) return result;
  const rows = page.getByRole("group", { name: ROW });
  const assigned = new Set<number>();

  for (const [i, certificate] of certificates.entries()) {
    const key = `certifications[${i}]`;
    if (!certificate.name?.trim()) {
      result.unresolved.push(key + ": missing name");
      continue;
    }
    let target: Locator | null = null;
    let targetIndex = -1;
    for (let j = 0; j < (await rows.count()); j++) {
      if (assigned.has(j) || !(await visible(rows.nth(j)))) continue;
      const name = await rows
        .nth(j)
        .getByLabel(fields.name)
        .first()
        .inputValue()
        .catch(() => null);
      if (name?.trim() === certificate.name.trim()) {
        target = rows.nth(j);
        targetIndex = j;
        break;
      }
    }
    if (!target) {
      for (let j = 0; j < (await rows.count()); j++) {
        if (assigned.has(j) || !(await visible(rows.nth(j)))) continue;
        const name = await rows
          .nth(j)
          .getByLabel(fields.name)
          .first()
          .inputValue()
          .catch(() => null);
        if (name === "") {
          target = rows.nth(j);
          targetIndex = j;
          break;
        }
      }
    }
    if (!target) {
      result.unresolved.push(key + ": no unoccupied certification row");
      continue;
    }
    assigned.add(targetIndex);
    const failures: string[] = [];
    for (const [field, value] of [
      ["name", certificate.name],
      ["issuer", certificate.issuer],
      ["credentialId", certificate.credentialId],
      ["url", certificate.url],
    ] as const) {
      if (
        value?.trim() &&
        !(await choose(target, page, fields[field], value.trim()))
      )
        failures.push(field);
    }
    for (const [field, value] of [
      ["issuedDate", certificate.issuedDate],
      ["expirationDate", certificate.expirationDate],
    ] as const) {
      if (value && !(await setMonth(target, fields[field], value)))
        failures.push(field);
    }
    if (failures.length)
      result.unresolved.push(key + ": " + failures.join(", "));
    else result.filled.push(key);
  }
  return result;
}
