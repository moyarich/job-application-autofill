/** Workday skill editor controls, isolated from other ATS providers. */
export const skillsFields = new Map([
  ["section", '[data-automation-id="skillsSection"], [data-automation-id="formField-skills"], section:has(> h2:text-is("Skills")), fieldset:has(> legend:text-is("Skills"))'],
  ["tokens", '[data-automation-id="selectedItem"], [data-skill-token]'],
  ["remove", '[data-automation-id="DELETE_charm"], button'],
  ["search", 'input[role="combobox"], input[aria-autocomplete], input[data-automation-id="searchBox"], input[placeholder="Type to Add Skills"], input[aria-label="Type to Add Skills"]'],
  ["selected", '[data-automation-id="selectedItem"], [data-automation-id="selectedItemList"] [data-automation-id="promptOption"], [data-skill-token]'],
  ["option", '[data-automation-id="promptOption"]'],
] as const);

export const skillsLabels = {
  text: /^skills\s*\*?$/i,
  search: /^Type to Add Skills$/i,
} as const;
