import type { CandidateProfile } from "../../../resume/src/types.ts";
export type FieldLocatorConfig = {
  labels: readonly RegExp[];
  selectors?: readonly string[];
};

export type WorkdayContactField = Extract<keyof CandidateProfile["contact"], string>;

/** Workday labels are exact to prevent matching an unrelated control. */
export const workdayContactFields = {
  firstName: { labels: [/^first name\s*\*?$/i, /^given name\s*\*?$/i] },
  middleName: { labels: [/^middle name\s*\*?$/i] },
  preferredName: { labels: [/^(?:preferred name|preferred first name)\s*\*?$/i] },
  lastName: { labels: [/^last name\s*\*?$/i, /^family name\s*\*?$/i] },
  email: { labels: [/^e.?mail(?: address)?\s*\*?$/i] },
  phone: { labels: [/^phone number\s*\*?$/i] },
  addressLine1: { labels: [/^(?:address line(?: 1)?|street address)\s*\*?$/i] },
  addressLine2: { labels: [/^address line 2\s*\*?$/i] },
  city: { labels: [/^city\s*\*?$/i] },
  state: { labels: [/^(?:state|state or province|province)\s*\*?$/i] },
  postalCode: { labels: [/^(?:postal code|zip(?: code)?)\s*\*?$/i] },
  country: { labels: [/^(?:country(?: \/ territory)?|country of residence)\s*\*?$/i] },
  phoneCountryCode: { labels: [/^(?:country(?: \/ territory)? phone code|phone country code)\s*\*?$/i] },
  phoneType: { labels: [/^(?:phone device type|phone type)\s*\*?$/i] },
  linkedIn: { labels: [/^linkedin(?: (?:profile|url))?\s*\*?$/i] },
  github: { labels: [/^github(?: (?:profile|url))?\s*\*?$/i] },
  website: { labels: [/^(?:website|personal website|portfolio(?: url)?)\s*\*?$/i] },
} satisfies Partial<Record<WorkdayContactField, FieldLocatorConfig>>;
