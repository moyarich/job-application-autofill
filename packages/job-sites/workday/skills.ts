import type { Page } from "playwright";

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
  const section = page
    .locator(
      '[data-automation-id="skillsSection"], [data-automation-id="formField-skills"], section:has(> h2:text-is("Skills")), fieldset:has(> legend:text-is("Skills"))',
    )
    .first();
  if (!(await section.isVisible().catch(() => false)))
    return { filled: [], unresolved: ["skills: section not visible"] };
  const tokens = section.locator(
    '[data-automation-id="selectedItem"], [data-skill-token]',
  );
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
    const remove = tokens
      .nth(index)
      .locator('[data-automation-id="DELETE_charm"], button')
      .first();
    if (await remove.count()) await remove.click({ timeout: 2000 });
  }
  const text = section.getByLabel(/^skills\s*\*?$/i).first();
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
  let search = section
    .locator(
      'input[role="combobox"], input[aria-autocomplete], input[data-automation-id="searchBox"], input[placeholder="Type to Add Skills"], input[aria-label="Type to Add Skills"]',
    )
    .first();
  if (!(await search.isVisible().catch(() => false)))
    search = section.getByLabel(/^Type to Add Skills$/i).first();
  if (!(await search.isVisible().catch(() => false)))
    return { filled: [], unresolved: ["skills: no supported input"] };
  for (const skill of values) {
    const selected = section
      .locator(
        '[data-automation-id="selectedItem"], [data-automation-id="selectedItemList"] [data-automation-id="promptOption"], [data-skill-token]',
      )
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
        .or(
          page
            .locator('[data-automation-id="promptOption"]')
            .getByText(skill, { exact: true }),
        )
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
