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
  replaceExisting = false,
) {
  const el = await input(row, key);
  if (!val && !replaceExisting) return true;
  if (!el) return false;
  const type = await el.getAttribute("type");
  if (type && !["text", "email", "tel", "month"].includes(type)) return false;
  const old = await el.inputValue().catch(() => null);
  if (old === null) return false;
  const expected = val ?? "";
  if (old.trim() === expected.trim()) return true;
  if (old.trim() && !replaceExisting) return false;
  try {
    await el.fill(expected, { timeout: 2000 });
    return (await el.inputValue()).trim() === expected.trim();
  } catch {
    return false;
  }
}
async function date(
  row: Locator,
  key: keyof typeof LABEL,
  raw: string | null | undefined,
  replaceExisting = false,
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
        if (old && Number(old) !== Number(value) && !replaceExisting)
          return false;
      }
      if ((await month.inputValue()) !== match[2]) await month.fill(match[2]);
      if ((await year.inputValue()) !== match[1]) await year.fill(match[1]);
      return (
        Number(await month.inputValue()) === Number(match[2]) &&
        Number(await year.inputValue()) === Number(match[1])
      );
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
    replaceExisting,
  );
}
async function fillRow(
  row: Locator,
  job: WorkExperienceEntry,
  replaceExisting: boolean,
) {
  const errors: string[] = [];
  for (const key of ["company", "jobTitle", "location", "description"] as const)
    if (
      !(await put(row, key, job[key], replaceExisting)) &&
      (job[key] || (await read(row, key)))
    )
      errors.push(key);
  if (!(await date(row, "startDate", job.startDate, replaceExisting)))
    errors.push("startDate");
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
  if (!job.isCurrent && job.endDate) {
    if (!(await date(row, "endDate", job.endDate, replaceExisting)))
      errors.push("endDate");
  } else if (
    !(await put(row, "endDate", "", replaceExisting)) &&
    (await read(row, "endDate"))?.trim()
  ) {
    errors.push("endDate");
  }
  return errors;
}
/** The selected Moya resume, never Workday's imported values, defines job order and contents. */
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

  // Validate resume data before modifying any imported Workday record.
  for (const [i, job] of experience.entries()) {
    if (
      !job?.company?.trim() ||
      !job?.jobTitle?.trim() ||
      !job.startDate?.trim()
    )
      result.unresolved.push(
        "experience[" + i + "]: incomplete resume employment record",
      );
  }
  if (result.unresolved.length) return result;

  const explicit = section.locator(ROW);
  const rows = (await explicit.count())
    ? explicit
    : section
        .getByText(/^Work Experience\s+\d+$/i, { exact: true })
        .locator("xpath=ancestor::*[.//input][1]");
  const add = section
    .getByRole("button", {
      name: /^(add|add another|add experience|add work experience)$/i,
    })
    .last();

  // Extra imported records are never silently retained alongside Moya's jobs.
  // Only delete from the end when each surplus card has its own clear remove control.
  // Check all controls before any deletion or filling.
  let count = await rows.count();
  if (count > experience.length) {
    for (let i = experience.length; i < count; i++) {
      const remove = rows.nth(i).getByRole("button", {
        name: /^(remove|remove experience|delete|delete experience)$/i,
      });
      if (
        (await remove.count()) !== 1 ||
        !(await remove.isVisible().catch(() => false)) ||
        !(await remove.isEnabled().catch(() => false))
      ) {
        result.unresolved.push(
          "experience: surplus Workday-imported rows require manual removal",
        );
        return result;
      }
    }
    for (let i = count - 1; i >= experience.length; i--) {
      try {
        const remove = rows.nth(i).getByRole("button", {
          name: /^(remove|remove experience|delete|delete experience)$/i,
        });
        await remove.click({ timeout: 2000 });
        await rows.nth(i).waitFor({ state: "detached", timeout: 2500 });
      } catch {
        result.unresolved.push(
          "experience: could not remove surplus imported row",
        );
        return result;
      }
    }
    count = await rows.count();
  }

  // Workday may have imported too few records. Append exactly as many as required.
  // Each new row must be empty before it is assigned to a resume job.
  while (count < experience.length) {
    if (
      !(await add.isVisible().catch(() => false)) ||
      !(await add.isEnabled().catch(() => false))
    ) {
      result.unresolved.push("experience: cannot add missing employment rows");
      return result;
    }
    try {
      await add.click({ timeout: 2000 });
      await rows.nth(count).waitFor({ state: "visible", timeout: 2500 });
      const newRow = rows.nth(count);
      if (
        (await read(newRow, "company")) !== "" ||
        (await read(newRow, "jobTitle")) !== ""
      ) {
        result.unresolved.push("experience: added row is not empty");
        return result;
      }
      count++;
    } catch {
      result.unresolved.push(
        "experience: could not add missing employment row",
      );
      return result;
    }
  }

  if ((await rows.count()) !== experience.length) {
    result.unresolved.push(
      "experience: Workday row count does not match the selected resume",
    );
    return result;
  }

  // Replace incorrect parser output by position, including incorrect titles,
  // employers, descriptions and dates. Do not depend on parser-derived matches.
  for (const [i, job] of experience.entries()) {
    const errors = await fillRow(rows.nth(i), job, true);
    if (errors.length)
      result.unresolved.push("experience[" + i + "]: " + errors.join(", "));
    else result.filled.push("experience[" + i + "]");
  }
  return result;
}
