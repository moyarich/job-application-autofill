import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "playwright";
import type {
  JobSiteStep,
  JobSiteStepContext,
  JobSiteStepResult,
} from "../types.ts";
import { fillWorkdayContact } from "./contact/contact.ts";
import { fillWorkdayExperience } from "./experience/experience.ts";
import { fillWorkdayEducation } from "./education/education.ts";
import { fillWorkdaySkills } from "./skills/skills.ts";
import { fillWorkdayCertifications, workdayCertificationsVisible } from "./certifications/certifications.ts";
import { retryWorkdayResumeUpload } from "./resume/resume.ts";
import { resumeFields } from "./resume/selectors.ts";
import { skillsFields } from "./skills/selectors.ts";
import { discoverQuestions } from "../index.ts";
import { SECTION as WORK_EXPERIENCE_SECTION } from "./experience/selectors.ts";
import { educationFields } from "./education/selectors.ts";

/** A navigation title alone does not mean that its form is open. */
async function hasEditableField(page: Page, selector: string): Promise<boolean> {
  const sections = page.locator(selector);
  for (let i = 0; i < await sections.count(); i++) {
    const section = sections.nth(i);
    if (!(await section.isVisible().catch(() => false))) continue;
    const inputs = section.locator('input:not([type="hidden"]):not([type="file"]), textarea, select, [role="combobox"]');
    for (let j = 0; j < await inputs.count(); j++) {
      const input = inputs.nth(j);
      if (await input.isVisible().catch(() => false) &&
          await input.isEnabled().catch(() => false))
        return true;
    }
  }
  return false;
}

async function educationIsOpen(page: Page): Promise<boolean> {
  const heading = page.getByText(educationFields.heading, { exact: true });
  for (let i = 0; i < await heading.count(); i++) {
    const section = heading.nth(i).locator("xpath=ancestor::*[.//button][1]");
    if (await section.isVisible().catch(() => false) &&
        await section.getByLabel(educationFields.institution).first().isVisible().catch(() => false))
      return true;
  }
  return false;
}

async function resumeUploadInput(page: Page) {
  const uploads = page.locator(resumeFields.upload);
  for (let i = 0; i < await uploads.count(); i++) {
    const upload = uploads.nth(i);
    // Native file inputs can be visually hidden behind a styled upload button.
    // Playwright can still setInputFiles on those. Require an enabled, empty
    // file input rather than hiding valid Workday upload controls.
    if (!(await upload.isEnabled().catch(() => false))) continue;
    const empty = await upload.evaluate((el) =>
      el instanceof HTMLInputElement && el.type === "file" &&
      !el.disabled && !el.files?.length).catch(() => false);
    if (empty) return upload;
  }
  return null;
}

async function screeningIsOpen(page: Page) {
  if (await hasEditableField(page,
    '[data-automation-id="questionnaireSection"], [data-automation-id="questionnaire"]'))
    return true;
  const headings = page.getByRole("heading", { name: /^(?:Application Questions|Screening Questions|Additional Questions|Questionnaire)$/i });
  for (let i = 0; i < await headings.count(); i++) {
    const section = headings.nth(i).locator("xpath=ancestor::*[.//input or .//textarea or .//select][1]");
    if (await section.isVisible().catch(() => false) &&
        await section.locator("input, textarea, select").first().isVisible().catch(() => false))
      return true;
  }
  return false;
}

/** Workday owns which operations exist and when to run each one. */
export const workdaySteps = [
  {
    id: "workday.personal-information",
    matches: async ({ page }) =>
      page.getByLabel(/^first name\s*\*?$/i).first().isVisible().catch(() => false),
    run: ({ page, profile }) => fillWorkdayContact(page, profile),
  },
  {
    id: "workday.work-experience",
    matches: ({ page, profile }) =>
      profile.experience.length
        ? hasEditableField(page, WORK_EXPERIENCE_SECTION)
        : Promise.resolve(false),
    run: async ({ page, profile }) => {
      const r = await fillWorkdayExperience(page, profile.experience);
      return { filled: r.filled, missing: r.unresolved };
    },
  },
  {
    id: "workday.education",
    matches: ({ page, profile }) =>
      profile.education.length
        ? educationIsOpen(page)
        : Promise.resolve(false),
    run: async ({ page, profile }) => {
      const r = await fillWorkdayEducation(page, profile.education);
      return { filled: r.filled, missing: r.unresolved };
    },
  },
  {
    id: "workday.skills",
    matches: async ({ page, profile }) =>
      profile.skills.length > 0 &&
      (await hasEditableField(page, skillsFields.section)),
    run: async ({ page, profile }) => {
      const r = await fillWorkdaySkills(page, profile.skills);
      return { filled: r.filled, missing: r.unresolved };
    },
  },
  {
    id: "workday.certifications",
    matches: ({ page, profile }) =>
      profile.certifications.length
        ? workdayCertificationsVisible(page)
        : Promise.resolve(false),
    run: async ({ page, profile }) => {
      const result = await fillWorkdayCertifications(page, profile.certifications);
      return { filled: result.filled, missing: result.unresolved };
    },
  },
  {
    id: "workday.resume",
    matches: async ({ page, pendingResume, resumeFile, resumeUploadUrls }) =>
      Boolean(pendingResume?.buffer?.length || resumeFile) &&
      !(resumeUploadUrls || []).includes(page.url()) &&
      Boolean(await resumeUploadInput(page)),
    run: async (context: JobSiteStepContext): Promise<JobSiteStepResult> => {
      const { page } = context;
      let { pendingResume, resumeFile } = context;
      let resumeUploadUrls = context.resumeUploadUrls || [];
      const filled: string[] = [],
        missing: string[] = [];
      const upload = await resumeUploadInput(page);
      if (!upload || resumeUploadUrls.includes(page.url()))
        return { filled, missing, pendingResume, resumeFile, resumeUploadUrls };
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
      return { filled, missing, pendingResume, resumeFile, resumeUploadUrls };
    },
  },
  {
    id: "workday.screening",
    matches: async ({ page }) => screeningIsOpen(page),
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
