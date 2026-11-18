import { validateResume } from "@moyarich/resume/validate";
import { renderResumePdf } from "@moyarich/resume/create-pdf";

export async function generateResumePdf(input: unknown) {
  const profile = validateResume(input);
  return renderResumePdf(profile);
}

async function extractWithQwen(text: string): Promise<unknown> {
  const url = process.env.RESUME_LLM_URL || "http://127.0.0.1:4178/parse";
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      redirect: "error",
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new Error(
      "Could not reach the local Qwen service. Check that it is running.",
    );
  }
  if (!response.ok)
    throw new Error(
      `The local Qwen service could not parse the resume (HTTP ${response.status}).`,
    );
  return response.json();
}

/** Dynamic import keeps resume extraction optional for JSON-only applicants. */
export async function parseResumeUpload(input: unknown) {
  const parser =
    input && typeof input === "object" && "parser" in input
      ? input.parser
      : "standard";
  if (parser !== "standard" && parser !== "qwen")
    throw new Error("Unknown resume parser.");

  const { decodeUpload, extractProfile, extractResumeText } =
    await import("@moyarich/resume");
  const upload = decodeUpload(input);
  const text = await extractResumeText(upload.buffer, upload.extension);
  const extracted = validateResume(
    parser === "qwen" ? await extractWithQwen(text) : extractProfile(text),
  );
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
