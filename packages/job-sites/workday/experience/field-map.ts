// Workday experience autofill: only visible, scoped and clearly labeled controls.
export const SECTION =
  '[data-automation-id="workExperienceSection"], [data-automation-id="workExperience"], section:has(> h2:text-is("Work Experience")), fieldset:has(> legend:text-is("Work Experience"))';
export const ROW =
  '[data-automation-id="workExperienceItem"], [data-automation-id="workExperienceCard"], [data-work-experience-entry], [data-automation-id^="workExperience-"]:not([data-automation-id*="--"])';
const BASE_LABEL = {
  company: /^(company|company name|employer)$/i,
  jobTitle: /^(job title|title|position)$/i,
  location: /^(location|job location)$/i,
  description:
    /^(role description|description|responsibilities(?: and achievements)?)$/i,
  startDate: /^(from|from date|start date)$/i,
  endDate: /^(to|to date|end date)$/i,
  isCurrent: /^(i currently work here|currently work here)$/i,
};
export const LABEL = Object.fromEntries(
  Object.entries(BASE_LABEL).map(([key, pattern]) => [
    key,
    new RegExp(pattern.source.replace("$", "\\s*\\*?\\s*$"), "i"),
  ]),
) as typeof BASE_LABEL;
export const DATE_FIELDS = {
  startDate: '[data-automation-id="formField-startDate"]',
  endDate: '[data-automation-id="formField-endDate"]',
  month: '[data-automation-id="dateSectionMonth-input"]',
  year: '[data-automation-id="dateSectionYear-input"]',
} as const;
