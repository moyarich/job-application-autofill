/** Workday education section labels and dropdown selectors. */
export const educationFields = {
  heading: /^Education$/i,
  row: /^Education\s+\d+$/i,
  institution: /^(school or university|school|university|institution)\s*\*?$/i,
  degree: /^degree\s*\*?$/i,
  fieldOfStudy: /^field of study\s*\*?$/i,
  add: /^(add|add another)$/i,
  search: /^Search$/i,
} as const;

export const educationSelectors = {
  promptOption: '[data-automation-id="promptOption"]',
} as const;
