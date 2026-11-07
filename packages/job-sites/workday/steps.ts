import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "playwright";
import type { JobSiteStep, JobSiteStepContext, JobSiteStepResult } from "../types.ts";
import { fillWorkdayContact } from "./contact/contact.ts";
import { fillWorkdayExperience } from "./experience.ts";
import { fillWorkdayEducation } from "./education.ts";
import { fillWorkdaySkills } from "./skills.ts";
import { retryWorkdayResumeUpload } from "./resume.ts";
import { discoverQuestions, fillQuestionAnswers } from "../index.ts";

async function has(page: Page, pattern: RegExp): Promise<boolean> {
  return page.getByText(pattern, { exact: true }).first().isVisible().catch(() => false);
}

/** Workday owns which operations exist and when to run each one. */
export const workdaySteps = [
  {
    id: "workday.personal-information",
    matches: async ({ page }) => has(page, /^My Information$/i) ||
      page.getByLabel(/^first name\s*\*?$/i).first().isVisible().catch(() => false),
    run: ({ page, profile }) => fillWorkdayContact(page, profile),
  },
  {
    id: "workday.work-experience",
    matches: ({ page, profile }) => profile.experience.length
      ? has(page, /^Work Experience$/i)
      : Promise.resolve(false),
    run: async ({ page, profile }) => {
      const r = await fillWorkdayExperience(page, profile.experience);
      return { filled: r.filled, missing: r.unresolved };
    },
  },
  {
    id: "workday.education",
    matches: ({ page, profile }) => profile.education.length
      ? has(page, /^Education$/i)
      : Promise.resolve(false),
    run: async ({ page, profile }) => {
      const r = await fillWorkdayEducation(page, profile.education);
      return { filled: r.filled, missing: r.unresolved };
    },
  },
  {
    id: "workday.skills",
    matches: async ({ page, profile }) => profile.skills.length > 0 &&
      (await has(page, /^Skills$/i) ||
       await page.locator('[data-automation-id="skillsSection"], [data-automation-id="formField-skills"]').first().isVisible().catch(() => false)),
    run: async ({ page, profile }) => {
      const r = await fillWorkdaySkills(page, profile.skills);
      return { filled: r.filled, missing: r.unresolved };
    },
  },
  {
    id: "workday.resume",
    matches: async ({ page, pendingResume, resumeFile }) =>
      Boolean(pendingResume || resumeFile) &&
      page.locator('input[type="file"]').count().then((count) => count > 0).catch(() => false),
    run: async (context: JobSiteStepContext): Promise<JobSiteStepResult> => {
      const { page } = context;
      let { pendingResume, resumeFile } = context;
      let resumeUploadUrls = context.resumeUploadUrls || [];
      const filled: string[] = [], missing: string[] = [];
      if (pendingResume?.buffer?.length) {
        const filename = join(context.directory, pendingResume.fileName);
        await writeFile(filename, pendingResume.buffer, { mode: 0o600 });
        resumeFile = filename;
        try {
          await page.locator('input[type="file"]').first().setInputFiles(filename, { timeout: 3000 });
          filled.push("resume");
          pendingResume = null;
          resumeUploadUrls = [...resumeUploadUrls, page.url()];
        } catch { missing.push("resume"); }
      } else if (resumeFile) {
        const r = await retryWorkdayResumeUpload(page, resumeFile, resumeUploadUrls);
        filled.push(...r.filled); missing.push(...r.missing);
        if (r.uploaded) resumeUploadUrls = [...resumeUploadUrls, page.url()];
      }
      return { filled, missing, pendingResume, resumeFile, resumeUploadUrls };
    },
  },
  {
    id: "workday.screening",
    matches: async ({ page }) =>
      page.locator('[data-automation-id="questionnaireSection"], [data-automation-id="questionnaire"]').first().isVisible().catch(() => false),
    run: async ({ page }) => ({
      filled: [], missing: [], questions: await discoverQuestions(page).catch(() => []),
    }),
  },
] satisfies readonly JobSiteStep[];

/** Workday screening operations use explicit applicant-supplied answers only. */
export const workdayScreening = {
  discover: (page: Page) => discoverQuestions(page),
  answer: async (page: Page, answers: Record<string, string>) => {
    const questions = await discoverQuestions(page);
    return fillQuestionAnswers(page, questions, answers);
  },
};
