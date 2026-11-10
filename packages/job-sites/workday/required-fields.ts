import type { Page } from "playwright";

/** Inspect only visible, enabled application controls; no values leave the browser. */
export async function missingWorkdayRequiredFields(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = document.querySelector("#mainContent") ?? document.querySelector("main");
    if (!root) return ["Application form not detected"];
    const visible = (node: Element) => {
      const element = node as HTMLElement;
      const style = window.getComputedStyle(element);
      return style.visibility !== "hidden" && style.display !== "none" &&
        element.getClientRects().length > 0 &&
        element.getAttribute("aria-hidden") !== "true";
    };
    const label = (element: Element) => {
      const node = element as HTMLElement;
      const associated = node.id ? root.querySelector('label[for="' + CSS.escape(node.id) + '"]') : null;
      return (node.getAttribute("aria-label") || associated?.textContent ||
        node.closest("label")?.textContent || node.getAttribute("placeholder") ||
        node.closest("[role=group]")?.getAttribute("aria-label") || "").trim();
    };
    const result = new Set<string>();
    const controls = root.querySelectorAll("input, textarea, select, [role=combobox], button");
    for (const control of controls) {
      const element = control as HTMLInputElement;
      if (!visible(control) || element.disabled || element.closest("[inert]")) continue;
      if (element.tagName === "INPUT" && ["hidden","file","submit","button","password"].includes(element.type)) continue;
      const name = label(control) || control.textContent?.trim() || "";
      const required = element.required || control.getAttribute("aria-required") === "true" ||
        /\*\s*$/.test(name) || /\bRequired\s*$/i.test(name);
      if (!required) continue;
      if (element.tagName === "BUTTON" && !/\b(?:Select One|Select) Required\b/i.test(name)) continue;
      const type = element.type;
      let empty = false;
      if (type === "checkbox" || type === "radio") {
        const group = element.name ? root.querySelectorAll('input[name="' + CSS.escape(element.name) + '"]') : [element];
        empty = !Array.from(group).some((entry) => (entry as HTMLInputElement).checked);
      } else if (element.tagName === "BUTTON") {
        empty = /\b(?:Select One|Select) Required\b/i.test(name);
      } else if (element.tagName === "SELECT") {
        const select = control as HTMLSelectElement;
        empty = !select.value || /^(?:select|select one|choose)$/i.test(select.selectedOptions?.[0]?.textContent?.trim() || "");
      } else {
        empty = !element.value?.trim() || /^(?:select one|select|choose)$/i.test(element.value?.trim() || "");
      }
      if (empty) result.add(name.replace(/\s*\*\s*$/, "").replace(/\s*Required\s*$/i, "").trim() || "Required field");
    }
    return Array.from(result);
  });
}

/** Always stop at sensitive employer steps, even when the inputs appear complete. */
export async function workdayNeedsManualReview(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.querySelector("#mainContent") ?? document.querySelector("main");
    if (!root) return true;
    const headings = Array.from(root.querySelectorAll("h1,h2,h3,legend,[role=heading]"))
      .map((element) => element.textContent || "").join(" ");
    const questions = Array.from(root.querySelectorAll("[role=group],fieldset"))
      .map((element) => element.getAttribute("aria-label") || element.querySelector("legend")?.textContent || "")
      .join(" ");
    return /(?:voluntary|disclos|equal employment|gender|ethnic|race|veteran|disabil|non.disclos|arbitration|agreement|consent|acknowledg|signature|certif(?:y|ication) that|privacy|terms and conditions|screening|application questions|questionnaire|review and submit|submit application)/i
      .test(headings + " " + questions);
  });
}
