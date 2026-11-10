import type { Page, Locator } from "playwright";

export interface WorkExperienceEntry {
  company: string;
  jobTitle: string;
  location?: string;
  description?: string;
  startDate: string;
  endDate?: string | null;
  isCurrent: boolean;
}
import { SECTION, ROW, LABEL, DATE_FIELDS } from "./selectors.ts";

async function input(row: Locator, key: keyof typeof LABEL) {
  const el = row.getByLabel(LABEL[key], { exact: true }).first();
  return (await el.isVisible().catch(() => false)) ? el : null;
}
async function read(row: Locator, key: keyof typeof LABEL) {
  const el = await input(row, key);
  return el ? el.inputValue().catch(() => null) : null;
}
async function put(
  row: Locator,
  key: keyof typeof LABEL,
  val: string | null | undefined,
) {
  if (!val) return true;
  const el = await input(row, key);
  if (!el) return false;
  const type = await el.getAttribute("type");
  if (type && !["text", "email", "tel", "month"].includes(type)) return false;
  const old = await el.inputValue().catch(() => null);
  if (old === null) return false;
  if (old.trim()) return old.trim() === val.trim();
  return el
    .fill(val, { timeout: 2000 })
    .then(() => true)
    .catch(() => false);
}
async function date(
  row: Locator,
  key: keyof typeof LABEL,
  raw: string | null | undefined,
) {
  if (!raw) return true;
  const match = /^([0-9]{4})(?:-(0[1-9]|1[0-2]))?$/.exec(raw);
  if (!match) return false;
  const el = await input(row, key);
  if (
    !el ||
    (await el.evaluate((node) => !["INPUT", "TEXTAREA"].includes(node.tagName)))
  ) {
    const field = row.locator(
      key === "startDate" ? DATE_FIELDS.startDate : DATE_FIELDS.endDate,
    );
    const month = field.locator(DATE_FIELDS.month);
    const year = field.locator(DATE_FIELDS.year);
    if (
      !match[2] ||
      !(await month.isVisible().catch(() => false)) ||
      !(await year.isVisible().catch(() => false))
    )
      return false;
    try {
      for (const [target, value] of [
        [month, match[2]],
        [year, match[1]],
      ] as const) {
        const old = await target.inputValue();
        if (old && Number(old) !== Number(value)) return false;
      }
      await month.fill(match[2]);
      await year.fill(match[1]);
      return true;
    } catch {
      return false;
    }
  }
  const type = await el.getAttribute("type");
  const hint = ((await el.getAttribute("placeholder")) || "").toLowerCase();
  if (
    type === "date" ||
    type === "number" ||
    /dd|day/.test(hint) ||
    (type === "month" && !match[2])
  )
    return false;
  return put(
    row,
    key,
    type === "month" || hint.includes("yyyy-mm")
      ? raw
      : match[2]
        ? match[2] + "/" + match[1]
        : match[1],
  );
}
async function fillRow(row: Locator, job: WorkExperienceEntry) {
  const errors: string[] = [];
  for (const key of ["company", "jobTitle", "location", "description"] as const)
    if (job[key] && !(await put(row, key, job[key]))) errors.push(key);
  if (!(await date(row, "startDate", job.startDate))) errors.push("startDate");
  const current = await input(row, "isCurrent");
  if (current) {
    try {
      if ((await current.getAttribute("type")) !== "checkbox")
        throw Error("not a checkbox");
      await current.setChecked(Boolean(job.isCurrent), { timeout: 2000 });
    } catch {
      errors.push("isCurrent");
    }
  } else if (job.isCurrent) errors.push("isCurrent");
  if (
    !job.isCurrent &&
    job.endDate &&
    !(await date(row, "endDate", job.endDate))
  )
    errors.push("endDate");
  return errors;
}
export async function fillWorkdayExperience(
  page: Page,
  experience: WorkExperienceEntry[],
) {
  const result: { filled: string[]; unresolved: string[] } = {
    filled: [],
    unresolved: [],
  };
  if (!Array.isArray(experience) || !experience.length) return result;
  let section = page.locator(SECTION).first();
  if (!(await section.isVisible().catch(() => false))) {
    const heading = page
      .getByText(/^Work Experience$/i, { exact: true })
      .first();
    if (await heading.isVisible().catch(() => false))
      section = heading.locator("xpath=ancestor::*[.//button][1]");
  }
  if (!(await section.isVisible().catch(() => false))) {
    result.unresolved = experience.map(
      (_, i) => "experience[" + i + "]: section not visible",
    );
    return result;
  }
  for (const [i, job] of experience.entries()) {
    const key = "experience[" + i + "]";
    if (!job?.company?.trim() || !job?.jobTitle?.trim()) {
      result.unresolved.push(key + ": missing company or title");
      continue;
    }
    const explicit = section.locator(ROW);
    const rows = (await explicit.count())
      ? explicit
      : section
          .getByText(/^Work Experience\s+\d+$/i, { exact: true })
          .locator("xpath=ancestor::*[.//input][1]");
    let row: Locator | null = null;
    for (let j = 0; j < (await rows.count()); j++) {
      const found = rows.nth(j);
      if (
        (await read(found, "company"))?.trim().toLowerCase() ===
          job.company.trim().toLowerCase() &&
        (await read(found, "jobTitle"))?.trim().toLowerCase() ===
          job.jobTitle.trim().toLowerCase()
      ) {
        row = found;
        break;
      }
    }
    // Resume upload may populate a title but leave employer and location blank.
    // Reuse an unambiguous matching row instead of adding a duplicate job.
    if (!row) {
      const candidates: Locator[] = [];
      for (let j = 0; j < (await rows.count()); j++) {
        const found = rows.nth(j);
        const company = (await read(found, "company"))?.trim().toLowerCase();
        const title = (await read(found, "jobTitle"))?.trim().toLowerCase();
        if (
          company !== undefined &&
          title !== undefined &&
          (!company || company === job.company.trim().toLowerCase()) &&
          (!title || title === job.jobTitle.trim().toLowerCase()) &&
          (company || title)
        )
          candidates.push(found);
      }
      if (candidates.length === 1) row = candidates[0];
    }
    if (!row)
      for (let j = 0; j < (await rows.count()); j++) {
        const found = rows.nth(j);
        if (
          (await read(found, "company")) === "" &&
          (await read(found, "jobTitle")) === ""
        ) {
          row = found;
          break;
        }
      }
    if (!row) {
      const button = section
        .getByRole("button", {
          name: /^(add|add another|add experience|add work experience)$/i,
        })
        .last();
      if (!(await button.isVisible().catch(() => false))) {
        result.unresolved.push(key + ": no add control");
        continue;
      }
      const count = await rows.count();
      try {
        await button.click({ timeout: 2000 });
        await rows.nth(count).waitFor({ state: "visible", timeout: 2500 });
      } catch {
        result.unresolved.push(key + ": could not add row");
        continue;
      }
      row = rows.nth(count);
      if (
        (await read(row, "company")) !== "" ||
        (await read(row, "jobTitle")) !== ""
      ) {
        result.unresolved.push(key + ": new row occupied");
        continue;
      }
    }
    const errors = await fillRow(row, job);
    if (errors.length) result.unresolved.push(key + ": " + errors.join(", "));
    else result.filled.push(key);
  }
  return result;
}
