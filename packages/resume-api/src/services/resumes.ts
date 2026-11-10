import { validateResume } from "../../../resume/src/resume-schema/validate.ts";
import { renderResumePdf } from "../../../resume/src/resume-schema/create-pdf.ts";

export async function generateResumePdf(input: unknown) {
  const profile = validateResume(input);
  return renderResumePdf(profile);
}

/** Dynamic import keeps resume extraction optional for JSON-only applicants. */
export async function parseResumeUpload(input: unknown) {
  const { decodeUpload, extractProfile, extractResumeText } = await import("../../../resume/src/extract-resume/index.ts");
  const upload = decodeUpload(input);
  const text = await extractResumeText(upload.buffer, upload.extension);
  const extracted = extractProfile(text);
  const profile = validateResume({
    ...extracted,
    source: { fileName: upload.fileName },
  });
  return {
    profile,
    preview: text,
    warnings: ["Review parsed fields before applying."],
  };
}
