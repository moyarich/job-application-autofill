import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "playwright";
import type { JobSiteAdapter, AutofillResult } from "../types.ts";

export interface ResumeStepContext {
  page: Page;
  directory: string;
  pendingResume: { fileName: string; buffer: Buffer } | null;
  resumeFile?: string;
  resumeUploadUrls?: string[];
}
export type ResumeStepResult = AutofillResult & Pick<ResumeStepContext, "pendingResume" | "resumeFile" | "resumeUploadUrls">;

/**
 * Resume upload strategy. Keep the pending attachment for a later step when
 * the current form has no upload control; never click a submit button.
 */
export async function fillResumeStep(context: ResumeStepContext, adapter: JobSiteAdapter): Promise<ResumeStepResult> {
  const { page } = context;
  let { pendingResume, resumeFile } = context;
  let resumeUploadUrls = context.resumeUploadUrls || [];
  const filled: string[] = [];
  const missing: string[] = [];
  if (pendingResume?.buffer?.length) {
    const filename = join(context.directory, pendingResume.fileName);
    await writeFile(filename, pendingResume.buffer, { mode: 0o600 });
    resumeFile = filename;
    try {
      const input = page.locator('input[type="file"]').first();
      if (await input.count()) {
        await input.setInputFiles(filename, { timeout: 3000 });
        filled.push("resume");
        pendingResume = null;
        resumeUploadUrls = [...resumeUploadUrls, page.url()];
      } else missing.push("resume");
    } catch {
      missing.push("resume");
    }
  }
  if (!pendingResume && resumeFile && adapter.retryResumeUpload) {
    const retry = await adapter.retryResumeUpload(page, resumeFile, resumeUploadUrls);
    filled.push(...retry.filled);
    missing.push(...retry.missing);
    if (retry.uploaded) resumeUploadUrls = [...resumeUploadUrls, page.url()];
  }
  return { filled, missing, pendingResume, resumeFile, resumeUploadUrls };
}
