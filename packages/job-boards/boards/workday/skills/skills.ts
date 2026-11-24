import type { Page } from "playwright";
import { skillsFields, skillsLabels } from "./selectors.ts";

// Only choose exact employer-provided options or explicitly labeled text fields.
export async function fillWorkdaySkills(page: Page, skills: string[]) {
  const result: { filled: string[]; unresolved: string[] } = {
    filled: [],
    unresolved: [],
  };
  const normalize = (value: string) =>
    Array.from(value)
      .filter(
        (character) =>
          character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
      )
      .join("")
      .trim();
  const seen = new Set<string>();
  const values = skills
    .filter((value) => typeof value === "string" && value.trim())
    .map(normalize)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (!values.length) return result;
  const section = page.locator(skillsFields.section).first();
  if (!(await section.isVisible().catch(() => false)))
    return { filled: [], unresolved: ["skills: section not visible"] };
  const tokens = section.locator(skillsFields.tokens);
  const saved = await tokens.evaluateAll((nodes) =>
    nodes.map((node) =>
      (
        node
          .querySelector("[data-automation-label]")
          ?.getAttribute("data-automation-label") ||
        node.textContent ||
        ""
      ).trim(),
    ),
  );
  const selectedNames = new Set<string>();
  const duplicates: number[] = [];
  for (const [index, label] of saved.entries()) {
    const key = normalize(label).toLowerCase();
    if (selectedNames.has(key)) duplicates.push(index);
    else if (key) selectedNames.add(key);
  }
  for (const index of duplicates.reverse()) {
    const remove = tokens.nth(index).locator(skillsFields.remove).first();
    if (await remove.count()) await remove.click({ timeout: 2000 });
  }
  const text = section.getByLabel(skillsLabels.text).first();
  if (
    (await text.isVisible().catch(() => false)) &&
    (await text.getAttribute("role")) !== "combobox" &&
    (await text.getAttribute("aria-autocomplete")) == null &&
    (await text.getAttribute("aria-haspopup")) == null
  ) {
    const old = await text.inputValue().catch(() => null);
    if (old === "") {
      await text.fill(values.join(", "));
      result.filled.push("skills");
      return result;
    }
  }
  let search = section.locator(skillsFields.search).first();
  if (!(await search.isVisible().catch(() => false)))
    search = section.getByLabel(skillsLabels.search).first();
  if (!(await search.isVisible().catch(() => false)))
    return { filled: [], unresolved: ["skills: no supported input"] };
  for (const skill of values) {
    const selected = section
      .locator(skillsFields.selected)
      .getByText(skill, { exact: true });
    if (selectedNames.has(skill.toLowerCase()) || (await selected.count())) {
      result.filled.push("skill: " + skill);
      continue;
    }
    try {
      await search.fill(skill, { timeout: 2000 });
      await search.press("Enter", { timeout: 2000 });
      const checkbox = page.getByRole("checkbox", { name: skill, exact: true });
      const option = page
        .getByRole("option", { name: skill, exact: true })
        .or(page.locator(skillsFields.option).getByText(skill, { exact: true }))
        .or(checkbox)
        .first();
      await option
        .or(selected.first())
        .first()
        .waitFor({ state: "visible", timeout: 2500 });
      if (
        !(await selected
          .first()
          .isVisible()
          .catch(() => false))
      ) {
        if (await checkbox.isVisible().catch(() => false))
          await checkbox.click({ timeout: 2000 });
        else await option.click({ timeout: 2000 });
      }
      await selected.first().waitFor({ state: "visible", timeout: 2000 });
      selectedNames.add(skill.toLowerCase());
      result.filled.push("skill: " + skill);
    } catch {
      result.unresolved.push("skill: " + skill);
    }
    await search.fill("").catch(() => {});
  }
  return result;
}
