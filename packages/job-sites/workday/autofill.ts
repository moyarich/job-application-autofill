import type { Page } from "playwright";
import type { CandidateProfile } from "../../resume/src/types.ts";
import { fillWorkdayEducation } from "./education.ts";
import { fillWorkdaySkills } from "./skills.ts";
import { fillWorkdayExperience } from "./experience.ts";

type AutofillResults = { filled: string[]; missing: string[] };

/**
 * Fill Workday-specific resume sections without coupling shared ATS automation
 * to Workday's application form structure.
 */
export async function fillWorkdayProfile(
  page: Page,
  profile: CandidateProfile,
): Promise<AutofillResults> {
  const filled: string[] = [];
  const missing: string[] = [];

  if (Array.isArray(profile.experience) && profile.experience.length) {
    const work = await fillWorkdayExperience(page, profile.experience);
    filled.push(...work.filled);
    missing.push(...work.unresolved);
  }

  const education = await fillWorkdayEducation(page, profile.education || []);
  filled.push(...education.filled);
  missing.push(...education.unresolved);

  const skills = await fillWorkdaySkills(page, profile.skills || []);
  filled.push(...skills.filled);
  missing.push(...skills.unresolved);

  return { filled, missing };
}

/** Skip a generic location field when Workday's work-history section is shown. */
export async function skipWorkdayLocation(page: Page): Promise<boolean> {
  return page
    .getByText(/^Work Experience$/i, { exact: true })
    .first()
    .isVisible()
    .catch(() => false);
}

/** Restore an already-saved resume on a subsequent Workday upload step. */
export async function retryWorkdayResumeUpload(
  page: Page,
  resumeFile: string,
  resumeUploadUrls: string[],
): Promise<AutofillResults & { uploaded: boolean }> {
  if (resumeUploadUrls.includes(page.url())) {
    return { filled: [], missing: [], uploaded: false };
  }
  const upload = page.locator('input[type="file"]').first();
  if (!(await upload.count()) ||
      (await upload.evaluate((node) => (node as HTMLInputElement).files?.length))) {
    return { filled: [], missing: [], uploaded: false };
  }

  try {
    await upload.setInputFiles(resumeFile, { timeout: 3000 });
    return { filled: ["resume"], missing: [], uploaded: true };
  } catch {
    return { filled: [], missing: ["resume attachment"], uploaded: false };
  }
}
