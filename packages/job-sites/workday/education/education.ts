import type { Page } from "playwright";
import type { CandidateProfile } from "../../../resume/src/types.ts";
import { educationFields, educationSelectors } from "./field-map.ts";

export async function fillWorkdayEducation(
  page: Page,
  entries: CandidateProfile["education"],
) {
  const result: { filled: string[]; unresolved: string[] } = {
    filled: [],
    unresolved: [],
  };
  if (!entries.length) return result;
  const heading = page.getByText(educationFields.get("heading")!, { exact: true }).first();
  if (!(await heading.isVisible().catch(() => false)))
    return { filled: [], unresolved: ["education: section not visible"] };
  const section = heading.locator("xpath=ancestor::*[.//button][1]");
  for (const [i, entry] of entries.entries()) {
    const key = `education[${i}]`;
    const rows = section
      .getByText(/^Education\s+\d+$/i, { exact: true })
      .locator("xpath=ancestor::*[.//input][1]");
    // Workday's numbered education cards keep school controls local to each entry.
    let target = null;
    for (let j = 0; j < (await rows.count()); j++) {
      const school = rows
        .nth(j)
        .getByLabel(
          educationFields.get("institution")!,
        )
        .first();
      const value = await school
        .inputValue({ timeout: 1000 })
        .catch(() => null);
      if (value === entry.institution || value === "") {
        target = rows.nth(j);
        break;
      }
    }
    if (!target) {
      const count = await rows.count();
      try {
        await section
          .getByRole("button", { name: educationFields.get("add")! })
          .last()
          .click({ timeout: 2000 });
        await rows.nth(count).waitFor({ state: "visible", timeout: 2500 });
        target = rows.nth(count);
      } catch {
        result.unresolved.push(key + ": could not add row");
        continue;
      }
    }
    const errors: string[] = [];
    const parts = entry.degree.split("|").map((value) => value.trim());
    for (const [label, value, name] of [
      [
        educationFields.get("institution")!,
        entry.institution,
        "institution",
      ],
      [educationFields.get("degree")!, parts[0], "degree"],
      [
        educationFields.get("fieldOfStudy")!,
        entry.fieldOfStudy || parts[1],
        "fieldOfStudy",
      ],
    ] as const) {
      if (!value) continue;
      const input = target.getByLabel(label).first();
      try {
        if (!(await input.isVisible().catch(() => false))) {
          errors.push(name);
          continue;
        }
        const old = await input.inputValue({ timeout: 1000 }).catch(() => null);
        if (
          old === value ||
          old?.replace(/\s*\([^)]*\)\s*$/, " ").trim() === value
        )
          continue;
        if (
          old &&
          !/^(select one|select)$/i.test(old) &&
          !(await input.evaluate((node) => node.tagName === "SELECT"))
        ) {
          errors.push(name);
          continue;
        }
        if (await input.evaluate((node) => node.tagName === "SELECT")) {
          const options = await input.locator("option").allTextContents();
          const match =
            options.find((option) => option.trim() === value) ||
            options.find(
              (option) =>
                option.replace(/\s*\([^)]*\)\s*$/, "").trim() === value,
            );
          if (!match) throw new Error("No matching option");
          await input.selectOption({ label: match }, { timeout: 2000 });
        } else if (
          (await input.getAttribute("aria-haspopup")) ||
          (await input.getAttribute("role")) === "combobox" ||
          (await input.evaluate((node) => node.tagName === "BUTTON"))
        ) {
          await input.click({ timeout: 2000 });
          await input.fill(value, { timeout: 700 }).catch(() => {});
          const search = target.getByPlaceholder(educationFields.get("search")!).last();
          if (await search.isVisible().catch(() => false)) {
            await search.fill(value);
            await search.press("Enter");
          }
          const name = new RegExp(
            "^" +
              value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
              "(?:\\s*\\([^)]*\\))?$",
            "i",
          );
          await page
            .getByRole("option", { name })
            .or(
              page
                .locator(educationSelectors.promptOption)
                .getByText(name, { exact: true }),
            )
            .or(page.getByRole("radio", { name }))
            .or(page.getByText(name, { exact: true }))
            .first()
            .click({ timeout: 2000 });
        } else await input.fill(value, { timeout: 2000 });
      } catch {
        errors.push(name);
      }
    }
    if (entry.startDate || entry.endDate) errors.push("dates");
    if (errors.length) result.unresolved.push(key + ": " + errors.join(", "));
    else result.filled.push(key);
  }
  return result;
}
