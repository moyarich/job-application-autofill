import type { Page } from "playwright";

/* -------------------------------------------------------------------------- */
/* Constants (passed into the page; page.evaluate callbacks can't close over  */
/* module scope)                                                              */
/* -------------------------------------------------------------------------- */

const ROOT_SELECTORS = ["#mainContent", "main"] as const;

const CONTROL_SELECTOR = "input, textarea, select, [role=combobox], button";

const IGNORED_INPUT_TYPES = [
  "hidden",
  "file",
  "submit",
  "button",
  "password",
] as const;

const PLACEHOLDER_VALUE = /^(?:select|select one|choose)$/i;
const SELECT_REQUIRED_BUTTON = /\b(?:Select One|Select) Required\b/i;
const REQUIRED_SUFFIX = /\bRequired\s*$/i;
const TRAILING_ASTERISK = /\s*\*\s*$/;
const TRAILING_REQUIRED = /\s*Required\s*$/i;

/** Employer steps that always need a human, even when the inputs look complete. */
const SENSITIVE_TERMS = [
  "voluntary",
  "disclos",
  "equal employment",
  "gender",
  "ethnic",
  "race",
  "veteran",
  "disabil",
  "non.disclos",
  "arbitration",
  "agreement",
  "consent",
  "acknowledg",
  "signature",
  "certif(?:y|ication) that",
  "privacy",
  "terms and conditions",
  "screening",
  "application questions",
  "questionnaire",
  "review and submit",
  "submit application",
];
const SENSITIVE_STEP = new RegExp(`(?:${SENSITIVE_TERMS.join("|")})`, "i");

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/** Inspect only visible, enabled application controls; no values leave the browser. */
export async function missingWorkdayRequiredFields(
  page: Page,
): Promise<string[]> {
  return page.evaluate(
    ({ rootSelectors, controlSelector, ignoredTypes, patterns }) => {
      const root = rootSelectors
        .map((selector) => document.querySelector(selector))
        .find(Boolean);
      if (!root) return ["Application form not detected"];

      // Playwright serializes RegExp arguments, so they arrive as real RegExps.
      const {
        placeholder,
        selectRequired,
        requiredSuffix,
        trailingAsterisk,
        trailingRequired,
      } = patterns;

      const isVisible = (el: HTMLElement) => {
        const style = window.getComputedStyle(el);
        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          el.getClientRects().length > 0 &&
          el.getAttribute("aria-hidden") !== "true"
        );
      };

      const labelOf = (el: HTMLElement) => {
        const associated = el.id
          ? root.querySelector(`label[for="${CSS.escape(el.id)}"]`)
          : null;
        return (
          el.getAttribute("aria-label") ||
          associated?.textContent ||
          el.closest("label")?.textContent ||
          el.getAttribute("placeholder") ||
          el.closest("[role=group]")?.getAttribute("aria-label") ||
          ""
        ).trim();
      };

      const isRequired = (el: HTMLInputElement, name: string) =>
        el.required ||
        el.getAttribute("aria-required") === "true" ||
        trailingAsterisk.test(name) ||
        requiredSuffix.test(name);

      const isEmpty = (el: HTMLInputElement, name: string): boolean => {
        if (el.tagName === "BUTTON") return selectRequired.test(name);

        if (el.type === "checkbox" || el.type === "radio") {
          const group = el.name
            ? root.querySelectorAll<HTMLInputElement>(
                `input[name="${CSS.escape(el.name)}"]`,
              )
            : [el];
          return !Array.from(group).some((entry) => entry.checked);
        }

        if (el.tagName === "SELECT") {
          const select = el as unknown as HTMLSelectElement;
          const selected =
            select.selectedOptions?.[0]?.textContent?.trim() || "";
          return !select.value || placeholder.test(selected);
        }

        const value = el.value?.trim() || "";
        return !value || placeholder.test(value);
      };

      const missing = new Set<string>();
      for (const control of root.querySelectorAll<HTMLInputElement>(
        controlSelector,
      )) {
        if (
          !isVisible(control) ||
          control.disabled ||
          control.closest("[inert]")
        )
          continue;
        if (
          control.tagName === "INPUT" &&
          ignoredTypes.includes(control.type as (typeof ignoredTypes)[number])
        )
          continue;

        const name = labelOf(control) || control.textContent?.trim() || "";
        if (!isRequired(control, name)) continue;
        // Buttons only count when they are an unfilled "Select One" dropdown.
        if (control.tagName === "BUTTON" && !selectRequired.test(name))
          continue;

        if (isEmpty(control, name)) {
          missing.add(
            name
              .replace(trailingAsterisk, "")
              .replace(trailingRequired, "")
              .trim() || "Required field",
          );
        }
      }
      return Array.from(missing);
    },
    {
      rootSelectors: [...ROOT_SELECTORS],
      controlSelector: CONTROL_SELECTOR,
      ignoredTypes: [...IGNORED_INPUT_TYPES],
      patterns: {
        placeholder: PLACEHOLDER_VALUE,
        selectRequired: SELECT_REQUIRED_BUTTON,
        requiredSuffix: REQUIRED_SUFFIX,
        trailingAsterisk: TRAILING_ASTERISK,
        trailingRequired: TRAILING_REQUIRED,
      },
    },
  );
}

/** Always stop at sensitive employer steps, even when the inputs appear complete. */
export async function workdayNeedsManualReview(page: Page): Promise<boolean> {
  return page.evaluate(
    ({ rootSelectors, sensitive }) => {
      const root = rootSelectors
        .map((selector) => document.querySelector(selector))
        .find(Boolean);
      if (!root) return true;

      const textOf = (selector: string, pick: (el: Element) => string) =>
        Array.from(root.querySelectorAll(selector)).map(pick).join(" ");

      const headings = textOf(
        "h1,h2,h3,legend,[role=heading]",
        (el) => el.textContent || "",
      );
      const questions = textOf(
        "[role=group],fieldset",
        (el) =>
          el.getAttribute("aria-label") ||
          el.querySelector("legend")?.textContent ||
          "",
      );

      return sensitive.test(`${headings} ${questions}`);
    },
    { rootSelectors: [...ROOT_SELECTORS], sensitive: SENSITIVE_STEP },
  );
}
