import type { Locator } from "playwright";

/** Read only visible Workday controls; a filled status never implies submission. */
export async function inspectWorkdayFields(
  fields: Locator,
): Promise<"filled" | "needs_review" | "ready" | undefined> {
  return fields.evaluateAll((nodes) => {
    const visible = [...new Set(nodes)].filter(
      (node) =>
        node instanceof HTMLElement &&
        node.getClientRects().length &&
        getComputedStyle(node).visibility !== "hidden" &&
        !node.hasAttribute("disabled"),
    );
    if (!visible.length) return undefined;
    let filled = false;
    for (const node of visible) {
      const labels =
        "labels" in node
          ? Array.from((node as HTMLInputElement).labels ?? [])
              .map((label) => label.textContent ?? "")
              .join(" ")
          : "";
      const labelledBy = (node.getAttribute("aria-labelledby") ?? "")
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ");
      const required =
        node.hasAttribute("required") ||
        node.getAttribute("aria-required") === "true" ||
        /\*/.test(labels + labelledBy);
      const input = node as HTMLInputElement;
      if (
        input.type === "hidden" ||
        input.type === "search" ||
        input.getAttribute("aria-autocomplete")
      )
        continue;
      const value =
        node instanceof HTMLInputElement ||
        node instanceof HTMLSelectElement ||
        node instanceof HTMLTextAreaElement
          ? String(node.value ?? "").trim()
          : (
              node.getAttribute("aria-valuetext") ??
              node.textContent ??
              ""
            ).trim();
      const empty =
        input.type === "checkbox" || input.type === "radio"
          ? !input.checked
          : !value ||
            /^(select one|select|choose(?: an? option)?)$/i.test(value);
      if (node.getAttribute("aria-invalid") === "true" || (required && empty))
        return "needs_review";
      if (!empty) filled = true;
    }
    return filled ? "filled" : "ready";
  });
}
