import { extractEmploymentHistory } from "./extractEmploymentHistory.ts";
import { extractEducation } from "./extractEducation.ts";
import { isSectionHeading, resumeSections } from "./resumeSections.ts";
import { skillWords } from "./skillWords.ts";

const LINE_BREAK_RE = /\r?\n/;
const WHITESPACE_RE = /\s+/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s.()-]{8,}\d)/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i;
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/i;
const WEBSITE_RE = /https?:\/\/(?!www\.(?:linkedin|github)\.com)[^\s)]+/i;
const NAME_CHARS_RE = /^[\p{L}][\p{L} .'-]+$/u;
const NON_NAME_WORDS_RE =
  /resume|experience|skills|education|summary|curriculum/i;

// Skills
const SKILL_GROUP_RE = /^([^:]+):\s*(.*)$/;
const SKILL_CATEGORY_PREFIX_RE = /^[A-Za-z][A-Za-z &/-]*:\s*/;
const SKILL_SPLIT_RE = /[,;•]/;
const REGEXP_SPECIAL_CHARS_RE = /[.*+?^${}()|[\]\\]/g;

// Certifications
const AWS_ISSUER_LINE_RE = /^Amazon Web Services(?:\s*\(AWS\))?$/i;
const AWS_CERT_RE = /^AWS Certified\b/i;

function escapeRegExp(value: string) {
  return value.replace(REGEXP_SPECIAL_CHARS_RE, "\\$&");
}

export function extractProfile(text: string) {
  // Some PDF fonts encode visible hyphens as control characters.
  text = text.replaceAll("\u0002", "-").replaceAll("\u00ad", "-");
  const lines = text
    .split(LINE_BREAK_RE)
    .map((line) => line.trim())
    .filter(Boolean);
  const contactText = lines
    .slice(0, lines.findIndex(isSectionHeading) >>> 0)
    .join("\n");
  const email = text.match(EMAIL_RE)?.[0] || "";
  const phone = text.match(PHONE_RE)?.[0]?.trim() || "";
  const linkedIn = text.match(LINKEDIN_RE)?.[0] || "";
  const github = text.match(GITHUB_RE)?.[0] || "";
  const website = contactText.match(WEBSITE_RE)?.[0] || "";
  const heading =
    lines.find(
      (line) =>
        line.length <= 65 &&
        NAME_CHARS_RE.test(line) &&
        line.split(WHITESPACE_RE).length >= 2 &&
        line.split(WHITESPACE_RE).length <= 4 &&
        !NON_NAME_WORDS_RE.test(line),
    ) || "";
  const parts = heading.split(WHITESPACE_RE).filter(Boolean);
  const { sections, additionalSections } = resumeSections(lines);
  const skillGroups: { heading: string; content: string }[] = [];
  for (const line of sections.skills || []) {
    const match = line.match(SKILL_GROUP_RE);
    if (match) skillGroups.push({ heading: match[1], content: match[2] });
    else if (skillGroups.length) skillGroups.at(-1)!.content += " " + line;
  }
  // Dynamic per-word patterns can't be constants, but the escaping can be shared.
  const skills = skillWords.filter((word) =>
    new RegExp(
      "(^|[^a-z0-9])" + escapeRegExp(word) + "($|[^a-z0-9])",
      "i",
    ).test(text),
  );
  // Join wrapped category values before splitting, preserving skills beyond the fallback vocabulary.
  const explicitSkills = (sections.skills || [])
    .map((line) => line.replace(SKILL_CATEGORY_PREFIX_RE, ","))
    .join(" ")
    .split(SKILL_SPLIT_RE)
    .map((value) => value.trim())
    .filter(Boolean);
  const parsedSkills = explicitSkills.length
    ? [...new Set(explicitSkills)]
    : skills;
  return {
    contact: {
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" "),
      email,
      phone,
      location: "",
      linkedIn,
      github,
      website,
    },
    additionalSections,
    skillGroups,
    summary: (sections.summary || []).join(" "),
    experience: extractEmploymentHistory(text),
    skills: parsedSkills,
    education: extractEducation(sections.education),
    projects: [],
    certifications: (sections.certifications || [])
      .filter(
        (name, index, lines) =>
          !(
            index > 0 &&
            AWS_ISSUER_LINE_RE.test(name) &&
            AWS_CERT_RE.test(lines[index - 1])
          ),
      )
      .map((name) => ({
        name,
        issuer: AWS_CERT_RE.test(name) ? "Amazon Web Services" : "",
        issuedDate: "",
        expirationDate: null,
        credentialId: "",
        url: "",
      })),
    languages: sections.languages || [],
    awards: sections.awards || [],
    source: { fileName: "" },
  };
}
