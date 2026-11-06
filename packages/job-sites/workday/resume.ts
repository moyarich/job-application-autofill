import type { Page } from "playwright";
import type { AutofillResult } from "../types.ts";

/** Restore an already-saved resume on a subsequent Workday upload step. */
export async function retryWorkdayResumeUpload(
  page: Page,
  resumeFile: string,
  resumeUploadUrls: string[],
): Promise<AutofillResult & { uploaded: boolean }> {
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
