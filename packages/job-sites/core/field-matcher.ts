import type { Locator, Page } from "playwright";

export type FieldLocatorConfig = {
  /** Accessible labels are preferred over implementation-specific CSS. */
  labels: readonly RegExp[];
  /** Optional, verified site-specific selectors in fallback order. */
  selectors?: readonly string[];
};

export type FieldMap<Key extends string = string> = ReadonlyMap<Key, FieldLocatorConfig>;

/**
 * Resolve only one visible, enabled, editable input.
 * A selector matching multiple elements is ambiguous: never choose .first().
 * This is deliberately a locator utility, not a generic form autofiller.
 */
export async function findMappedField<Key extends string>(
  page: Page,
  fields: FieldMap<Key>,
  key: Key,
): Promise<Locator | null> {
  const config = fields.get(key);
  if (!config) return null;

  const candidates: Locator[] = [
    ...config.labels.map((label) => page.getByLabel(label, { exact: true })),
    ...(config.selectors ?? []).map((selector) => page.locator(selector)),
  ];
  for (const candidate of candidates) {
    const count = await candidate.count().catch(() => 0);
    if (count > 1) return null; // Ambiguity must be reviewed, not worked around.
    if (count !== 1) continue;
    if (!(await candidate.isVisible().catch(() => false))) continue;
    if (!(await candidate.isEnabled().catch(() => false))) continue;

    const editable = await candidate.evaluate((node) => {
      const tag = node.tagName;
      if (!["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return false;
      if (tag === "INPUT") {
        const input = node as HTMLInputElement;
        if (["hidden", "password", "file", "checkbox", "radio", "submit"].includes(input.type)) return false;
        if (input.readOnly) return false;
      }
      if (tag === "TEXTAREA" && (node as HTMLTextAreaElement).readOnly) return false;
      return true;
    }).catch(() => false);
    if (editable) return candidate;
  }
  return null;
}
