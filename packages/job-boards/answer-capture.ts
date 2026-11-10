import type { Page } from "playwright";
import { classifyQuestion, discoverQuestions } from "./index.ts";

/** Read completed screening answers from the employer page, never a dashboard form. */
export async function captureEmployerAnswers(
  page: Page,
): Promise<Record<string, string>> {
  const questions = (await discoverQuestions(page)).filter(
    (q) =>
      classifyQuestion(q.label) === "general" &&
      !/^(?:first|last|middle|preferred|full) name|(?:e-?mail|phone|mobile|address|city|state|zip|postal|country|linkedin|github|website|resume|cover letter|password|username|signature)/i.test(
        q.label,
      ),
  );
  if (!questions.length) return {};
  return page.evaluate(
    (labels) => {
      const expected = new Set(labels.map((label) => label.toLowerCase()));
      const answers: Record<string, string> = {};
      const fields = [
        ...document.querySelectorAll(
          "input, textarea, select, [role=combobox]",
        ),
      ];
      for (const element of fields) {
        if (
          !(element instanceof HTMLElement) ||
          !element.getClientRects().length ||
          element.closest("[hidden], [aria-hidden=true]")
        )
          continue;
        const input = element instanceof HTMLInputElement ? element : null;
        if (
          input &&
          /^(hidden|file|password|submit|button|reset|image|email|tel)$/i.test(
            input.type,
          )
        )
          continue;
        const group = element.closest(
          "fieldset, [role=group], [role=radiogroup]",
        );
        const linkedLabel = element.id
          ? document.querySelector(
              'label[for="' + CSS.escape(element.id) + '"]',
            )
          : null;
        const label = (
          group?.querySelector("legend, [role=heading]")?.textContent ||
          linkedLabel?.textContent ||
          element.closest("label")?.textContent ||
          element.getAttribute("aria-label") ||
          element.getAttribute("placeholder") ||
          element.getAttribute("name") ||
          ""
        )
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 300);
        if (!expected.has(label.toLowerCase())) continue;
        let value = "";
        if (input?.type === "radio") {
          if (!input.checked) continue;
          value = (
            linkedLabel?.textContent ||
            input.closest("label")?.textContent ||
            input.value
          ).trim();
        } else if (input?.type === "checkbox") {
          value = input.checked ? "Yes" : "No";
        } else if (element instanceof HTMLSelectElement) {
          if (!element.value || element.selectedIndex < 0) continue;
          value =
            element.selectedOptions[0]?.textContent?.trim() || element.value;
        } else if (input) value = input.value.trim();
        else if (element instanceof HTMLTextAreaElement)
          value = element.value.trim();
        else if (element.getAttribute("role") === "combobox") {
          value = (
            element.getAttribute("aria-valuetext") ||
            element.textContent ||
            ""
          ).trim();
        }
        if (
          value &&
          value.length <= 4000 &&
          !/^(?:select|choose|please select)(?: an? (?:option|answer))?\.{0,3}$/i.test(
            value,
          )
        )
          answers[label] = value;
      }
      return answers;
    },
    questions.map((q) => q.label),
  );
}
