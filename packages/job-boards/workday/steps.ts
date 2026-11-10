import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Locator, Page } from "playwright";
import type {
  JobSiteStep,
  JobSiteStepContext,
  JobSiteStepResult,
} from "../types.ts";
import { fillWorkdayContact } from "./contact/contact.ts";
import { fillWorkdayExperience } from "./experience/experience.ts";
import { fillWorkdayEducation } from "./education/education.ts";
import { fillWorkdaySkills } from "./skills/skills.ts";
import {
  fillWorkdayCertifications,
  workdayCertificationsVisible,
} from "./certifications/certifications.ts";
import { retryWorkdayResumeUpload } from "./resume/resume.ts";
import { resumeFields } from "./resume/selectors.ts";
import { skillsFields } from "./skills/selectors.ts";
import { discoverQuestions } from "../index.ts";
import { SECTION as WORK_EXPERIENCE_SECTION } from "./experience/selectors.ts";
import { educationFields } from "./education/selectors.ts";
import { inspectWorkdayFields } from "./menu-status.ts";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const EDITABLE_CONTROLS =
  'input:not([type="hidden"]):not([type="file"]), textarea, select, [role="combobox"]';

const SCREENING_SECTIONS =
  '[data-automation-id="questionnaireSection"], [data-automation-id="questionnaire"]';

const SCREENING_HEADING =
  /^(?:Application Questions|Screening Questions|Additional Questions|Questionnaire)$/i;

const PERSONAL_INFO_LABELS =
  /^(first name|last name|given name|family name|e.?mail(?: address)?|phone number|address line 1|city|state|postal code|country(?: \/ territory)? phone code)\s*\*?$/i;

const CERTIFICATION_LABELS =
  /^(certification|certification name|issuing organization|issuer|credential id)\s*\*?$/i;

const PLACEHOLDER_VALUE = /^(select one|select|choose.*)$/i;

/* -------------------------------------------------------------------------- */
/* Locator helpers                                                            */
/* -------------------------------------------------------------------------- */

const isVisible = (l: Locator) => l.isVisible().catch(() => false);
const isEnabled = (l: Locator) => l.isEnabled().catch(() => false);

/** Every match of `locator`, in order. */
async function all(locator: Locator): Promise<Locator[]> {
  const n = await locator.count();
  return Array.from({ length: n }, (_, i) => locator.nth(i));
}

async function visible(locator: Locator): Promise<Locator[]> {
  const out: Locator[] = [];
  for (const l of await all(locator)) if (await isVisible(l)) out.push(l);
  return out;
}

/** Current text of an input-like control, trimmed. */
async function valueOf(control: Locator): Promise<string> {
  return (await control.inputValue().catch(() => control.innerText())).trim();
}

const toStepResult = (r: { filled: string[]; unresolved: string[] }) => ({
  filled: r.filled,
  missing: r.unresolved,
});

/* -------------------------------------------------------------------------- */
/* "Is this section actually open?" predicates                                */
/* -------------------------------------------------------------------------- */

/** A navigation title alone does not mean that its form is open. */
async function hasEditableField(
  page: Page,
  selector: string,
): Promise<boolean> {
  for (const section of await visible(page.locator(selector))) {
    for (const input of await visible(section.locator(EDITABLE_CONTROLS))) {
      if (await isEnabled(input)) return true;
    }
  }
  return false;
}

async function educationIsOpen(page: Page): Promise<boolean> {
  const headings = await all(
    page.getByText(educationFields.heading, { exact: true }),
  );
  for (const heading of headings) {
    const section = heading.locator("xpath=ancestor::*[.//button][1]");
    if (
      (await isVisible(section)) &&
      (await isVisible(section.getByLabel(educationFields.institution).first()))
    )
      return true;
  }
  return false;
}

async function screeningIsOpen(page: Page): Promise<boolean> {
  if (await hasEditableField(page, SCREENING_SECTIONS)) return true;

  const headings = await all(
    page.getByRole("heading", { name: SCREENING_HEADING }),
  );
  for (const heading of headings) {
    const section = heading.locator(
      "xpath=ancestor::*[.//input or .//textarea or .//select][1]",
    );
    if (
      (await isVisible(section)) &&
      (await isVisible(section.locator("input, textarea, select").first()))
    )
      return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Status inspection                                                          */
/* -------------------------------------------------------------------------- */

async function inspectEducation({ page }: { page: Page }) {
  const schools = await visible(page.getByLabel(educationFields.institution));
  for (const school of schools) {
    if (!(await valueOf(school))) return "needs_review" as const;
  }

  for (const degree of await visible(page.getByLabel(educationFields.degree))) {
    const value = await valueOf(degree);
    if (!value || PLACEHOLDER_VALUE.test(value)) return "needs_review" as const;
  }

  return schools.length ? ("filled" as const) : undefined;
}

async function inspectSkills({ page }: { page: Page }) {
  const [section] = await visible(page.locator(skillsFields.section));
  if (!section) return undefined;
  return (await section.locator(skillsFields.selected).count()) > 0
    ? ("filled" as const)
    : ("ready" as const);
}

/* -------------------------------------------------------------------------- */
/* Resume                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Native file inputs are often visually hidden behind a styled button, and
 * Playwright can still setInputFiles on them — so require an enabled, empty
 * file input rather than a visible one.
 */
async function resumeUploadInput(page: Page): Promise<Locator | null> {
  for (const upload of await all(page.locator(resumeFields.upload))) {
    if (!(await isEnabled(upload))) continue;
    const empty = await upload
      .evaluate(
        (el) =>
          el instanceof HTMLInputElement &&
          el.type === "file" &&
          !el.disabled &&
          !el.files?.length,
      )
      .catch(() => false);
    if (empty) return upload;
  }
  return null;
}

async function runResumeStep(
  context: JobSiteStepContext,
): Promise<JobSiteStepResult> {
  const { page } = context;
  let { pendingResume, resumeFile } = context;
  let resumeUploadUrls = context.resumeUploadUrls || [];
  const filled: string[] = [];
  const missing: string[] = [];
  const result = () => ({
    filled,
    missing,
    pendingResume,
    resumeFile,
    resumeUploadUrls,
  });

  const upload = await resumeUploadInput(page);
  if (!upload || resumeUploadUrls.includes(page.url())) return result();

  if (pendingResume?.buffer?.length) {
    const filename = join(context.directory, pendingResume.fileName);
    await writeFile(filename, pendingResume.buffer, { mode: 0o600 });
    resumeFile = filename;
    try {
      await upload.setInputFiles(filename, { timeout: 3000 });
      filled.push("resume");
      pendingResume = null;
      resumeUploadUrls = [...resumeUploadUrls, page.url()];
    } catch {
      missing.push("resume");
    }
  } else if (resumeFile) {
    const r = await retryWorkdayResumeUpload(
      page,
      resumeFile,
      resumeUploadUrls,
    );
    filled.push(...r.filled);
    missing.push(...r.missing);
    if (r.uploaded) resumeUploadUrls = [...resumeUploadUrls, page.url()];
  }

  return result();
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                      */
/* -------------------------------------------------------------------------- */

/** Workday owns which operations exist and when to run each one. */
export const workdaySteps = [
  {
    id: "workday.personal-information",
    inspectStatus: ({ page }) =>
      inspectWorkdayFields(page.getByLabel(PERSONAL_INFO_LABELS)),
    matches: ({ page }) =>
      isVisible(page.getByLabel(/^first name\s*\*?$/i).first()),
    run: ({ page, profile }) => fillWorkdayContact(page, profile),
  },
  {
    id: "workday.work-experience",
    inspectStatus: ({ page }) =>
      inspectWorkdayFields(
        page
          .locator(WORK_EXPERIENCE_SECTION)
          .locator(
            'input:not([type="hidden"]), textarea, select, button[aria-haspopup]',
          ),
      ),
    matches: async ({ page, profile }) =>
      profile.experience.length > 0 &&
      (await hasEditableField(page, WORK_EXPERIENCE_SECTION)),
    run: async ({ page, profile }) =>
      toStepResult(await fillWorkdayExperience(page, profile.experience)),
  },
  {
    id: "workday.education",
    inspectStatus: inspectEducation,
    matches: async ({ page, profile }) =>
      profile.education.length > 0 && (await educationIsOpen(page)),
    run: async ({ page, profile }) =>
      toStepResult(await fillWorkdayEducation(page, profile.education)),
  },
  {
    id: "workday.skills",
    inspectStatus: inspectSkills,
    matches: async ({ page, profile }) =>
      profile.skills.length > 0 &&
      (await hasEditableField(page, skillsFields.section)),
    run: async ({ page, profile }) =>
      toStepResult(await fillWorkdaySkills(page, profile.skills)),
  },
  {
    id: "workday.certifications",
    inspectStatus: ({ page }) =>
      inspectWorkdayFields(page.getByLabel(CERTIFICATION_LABELS)),
    matches: async ({ page, profile }) =>
      profile.certifications.length > 0 &&
      (await workdayCertificationsVisible(page)),
    run: async ({ page, profile }) =>
      toStepResult(
        await fillWorkdayCertifications(page, profile.certifications),
      ),
  },
  {
    id: "workday.resume",
    matches: async ({ page, pendingResume, resumeFile, resumeUploadUrls }) =>
      Boolean(pendingResume?.buffer?.length || resumeFile) &&
      !(resumeUploadUrls || []).includes(page.url()) &&
      Boolean(await resumeUploadInput(page)),
    run: runResumeStep,
  },
  {
    id: "workday.screening",
    matches: ({ page }) => screeningIsOpen(page),
    run: async ({ page }) => ({
      filled: [],
      missing: [],
      questions: await discoverQuestions(page).catch(() => []),
    }),
  },
] satisfies readonly JobSiteStep[];

/** Workday question discovery is read-only; users answer on the employer form. */
export const workdayScreening = {
  discover: (page: Page) => discoverQuestions(page),
};
