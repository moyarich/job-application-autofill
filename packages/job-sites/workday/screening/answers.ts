import type { Page, Locator } from "playwright";
import { classifyQuestion, discoverQuestions } from "../../index.ts";

const BLOCKED = /(?:agree|agreement|arbitration|non.disclosure|consent|acknowledge|certif(?:y|ication) that|electronic signature|signature|terms and conditions|privacy policy|gender|race|ethnic|veteran|disability)/i;
const normalize = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

async function chooseOption(page: Page, answer: string) {
  const options = [
    page.getByRole("option", { name: answer, exact: true }),
    page.getByRole("listbox").getByText(answer, { exact: true }),
  ];
  for (const option of options) {
    if (await option.count() === 1 && await option.isVisible().catch(() => false)) {
      await option.click({ timeout: 2000 });
      return true;
    }
  }
  return false;
}

async function existing(control: Locator) {
  return control.inputValue().catch(() => "");
}

/**
 * Apply only explicitly saved answers to precisely matched, nonsensitive questions.
 * Workday choices are frequently buttons opening a portal listbox.
 */
export async function fillWorkdayScreeningAnswers(
  page: Page,
  answers: Record<string, string>,
) {
  const result = { filled: [] as string[], unresolved: [] as string[] };
  const questions = await discoverQuestions(page);
  for (const [label, raw] of Object.entries(answers)) {
    const answer = typeof raw === "string" ? raw.trim() : "";
    const match = questions.filter((q) => normalize(q.label) === normalize(label));
    const group = page.getByRole("group", { name: label, exact: true });
    const customButton = group.getByRole("button", { name: /^(?:Select One(?: Required)?|Select)$/i });
    const custom = match.length === 0 && await group.count() === 1 && await customButton.count() === 1;
    if (!answer || (match.length !== 1 && !custom) || classifyQuestion(label) !== "general" ||
      BLOCKED.test(label)) {
      result.unresolved.push(label);
      continue;
    }
    const question = match[0];
    try {
      if (custom) {
        await customButton.click({ timeout: 2000 });
        if (!(await chooseOption(page, answer))) throw new Error("No exact Workday option");
      } else if (question.kind === "radio") {
        if (await group.count() !== 1) throw new Error("Ambiguous group");
        const selected = group.getByRole("radio", { checked: true });
        if (await selected.count()) {
          const current = await selected.first().getAttribute("value");
          if (current && normalize(current) !== normalize(answer)) throw new Error("Conflicting answer");
        }
        const option = group.getByRole("radio", { name: answer, exact: true });
        if (await option.count() !== 1) throw new Error("Ambiguous choice");
        await option.check({ timeout: 2000 });
      } else if (question.kind === "checkbox") {
        // Never act on consent-like checkboxes.
        throw new Error("Checkbox requires manual review");
      } else if (question.kind === "select") {
        const control = page.getByLabel(label, { exact: true });
        if (await control.count() !== 1) throw new Error("Ambiguous select");
        const values = await control.locator("option").allTextContents();
        if (!values.some((v) => normalize(v) === normalize(answer))) throw new Error("No exact option");
        const current = await control.locator("option:checked").textContent().catch(() => "");
        if (current && !/^(select|select one|choose)$/i.test(current.trim()) &&
          normalize(current) !== normalize(answer)) throw new Error("Conflicting answer");
        await control.selectOption({ label: values.find((v) => normalize(v) === normalize(answer))! });
      } else if (question.kind === "combobox") {
        const control = page.getByRole("combobox", { name: label, exact: true });
        if (await control.count() !== 1) throw new Error("Ambiguous combobox");
        const current = await existing(control);
        if (current && normalize(current) !== normalize(answer)) throw new Error("Conflicting answer");
        if (normalize(current) !== normalize(answer)) {
          await control.click({ timeout: 2000 });
          if (await control.evaluate((el) => el.tagName) === "INPUT")
            await control.fill(answer);
          if (!(await chooseOption(page, answer))) throw new Error("No exact option");
        }
      } else {
        const control = page.getByLabel(label, { exact: true });
        if (await control.count() !== 1) throw new Error("Ambiguous field");
        const current = await existing(control);
        if (current && normalize(current) !== normalize(answer)) throw new Error("Conflicting answer");
        if (!current) await control.fill(answer, { timeout: 2000 });
      }
      result.filled.push(label);
    } catch {
      result.unresolved.push(label);
    }
  }
  return result;
}
