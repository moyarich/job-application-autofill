import type { CandidateProfile } from "../../../resume/src/types.ts";
export type FieldLocatorConfig = {
  labels: readonly RegExp[];
  selectors?: readonly string[];
};

/**
 * Workday-specific contact labels. Update this map when a verified employer
 * form changes; the autofill logic and other providers stay unchanged.
 *
 * Do not add generic CSS selectors without fixtures verifying their identity.
 * In particular, phone must never resolve to a country/area-code control.
 */
export type WorkdayContactField = Extract<keyof CandidateProfile["contact"], string>;

export const workdayContactFields = new Map<WorkdayContactField, FieldLocatorConfig>([
  ["firstName", { labels: [/^first name\s*\*?$/i, /^given name\s*\*?$/i] }],
  ["lastName", { labels: [/^last name\s*\*?$/i, /^family name\s*\*?$/i] }],
  ["email", { labels: [/^e.?mail(?: address)?\s*\*?$/i] }],
  ["phone", { labels: [/^phone number\s*\*?$/i] }],
  ["addressLine1", { labels: [/^address line 1\s*\*?$/i] }],
  ["addressLine2", { labels: [/^address line 2\s*\*?$/i] }],
  ["city", { labels: [/^city\s*\*?$/i] }],
  ["state", { labels: [/^(?:state|state or province|province)\s*\*?$/i] }],
  ["postalCode", { labels: [/^(?:postal code|zip(?: code)?)\s*\*?$/i] }],
]);
