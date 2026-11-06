import type { CandidateProfile } from "../types.ts";
// Platform-neutral runtime validation of the canonical resume-schema contract.
// Does not import PDF/OCR packages or require a resume attachment.
const STRING_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "location",
  "linkedIn",
  "github",
  "website",
];
const ROOT_FIELDS = [
  "contact",
  "summary",
  "experience",
  "skills",
  "education",
  "projects",
  "certifications",
  "languages",
  "awards",
  "source",
];
const ENTRIES = {
  experience: {
    strings: ["company", "jobTitle", "location", "startDate", "description"],
    other: ["endDate", "isCurrent"],
  },
  education: {
    strings: [
      "institution",
      "degree",
      "fieldOfStudy",
      "location",
      "startDate",
      "description",
    ],
    other: ["endDate"],
  },
  projects: {
    strings: ["name", "description", "url"],
    other: ["technologies"],
  },
  certifications: {
    strings: ["name", "issuer", "issuedDate", "credentialId", "url"],
    other: ["expirationDate"],
  },
};
function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(field + " must be an object");
  return value as Record<string, unknown>;
}
function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  field: string,
) {
  for (const name of expected)
    if (!(name in value)) throw new Error(field + "." + name + " is required");
  for (const name of Object.keys(value))
    if (!expected.includes(name))
      throw new Error(field + "." + name + " is not allowed");
}
function strings(
  value: Record<string, unknown>,
  fields: readonly string[],
  field: string,
) {
  for (const name of fields)
    if (typeof value[name] !== "string")
      throw new Error(field + "." + name + " must be a string");
}
function date(value: unknown) {
  return (
    typeof value === "string" &&
    (value === "" || /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/.test(value))
  );
}
function dateOrNull(value: unknown) {
  return value === null || date(value);
}
export function validateResume(value: unknown): CandidateProfile {
  const resume = object(value, "resume");
  exactKeys(
    resume,
    [
      ...ROOT_FIELDS,
      ...["additionalSections", "skillGroups"].filter((key) => key in resume),
    ],
    "resume",
  );
  for (const key of ["additionalSections", "skillGroups"]) {
    if (!(key in resume)) continue;
    if (!Array.isArray(resume[key])) throw new Error(key + " must be an array");
    for (const raw of resume[key]) {
      const entry = object(raw, key);
      exactKeys(entry, ["heading", "content"], key);
      strings(entry, ["heading", "content"], key);
    }
  }
  const contact = object(resume.contact, "contact");
  exactKeys(contact, STRING_FIELDS, "contact");
  strings(contact, STRING_FIELDS, "contact");
  if (typeof resume.summary !== "string")
    throw new Error("summary must be a string");
  const source = object(resume.source, "source");
  exactKeys(source, ["fileName"], "source");
  strings(source, ["fileName"], "source");
  for (const section of ["skills", "languages", "awards"]) {
    if (
      !Array.isArray(resume[section]) ||
      !resume[section].every((item) => typeof item === "string")
    )
      throw new Error(section + " must be an array of strings");
  }
  for (const [section, definition] of Object.entries(ENTRIES)) {
    const entries = resume[section];
    if (!Array.isArray(entries)) throw new Error(section + " must be an array");
    for (const [index, raw] of entries.entries()) {
      const field = section + "[" + index + "]";
      const entry = object(raw, field);
      exactKeys(entry, [...definition.strings, ...definition.other], field);
      strings(entry, definition.strings, field);
      if (section === "experience" || section === "education") {
        if (!date(entry.startDate) || !dateOrNull(entry.endDate))
          throw new Error(field + " has invalid dates (use YYYY or YYYY-MM)");
      }
      if (section === "experience" && typeof entry.isCurrent !== "boolean")
        throw new Error(field + ".isCurrent must be a boolean");
      if (
        section === "projects" &&
        (!Array.isArray(entry.technologies) ||
          !entry.technologies.every((item) => typeof item === "string"))
      )
        throw new Error(field + ".technologies must be an array of strings");
      if (
        section === "certifications" &&
        (!date(entry.issuedDate) || !dateOrNull(entry.expirationDate))
      )
        throw new Error(field + " has invalid certification dates");
    }
  }
  return resume as unknown as CandidateProfile;
}
export function parseResumeJson(text: string): CandidateProfile {
  return validateResume(JSON.parse(text));
}

export {
  markdownToHtml,
  markdownToPlainText,
  resumeToPlainText,
  resumeToMarkdown,
  markdownToEditor,
  editorToMarkdown,
} from "./markdown.ts";
export type {
  RichTextBlock,
  RichTextLeaf,
  RichTextDocument,
} from "./markdown.ts";
