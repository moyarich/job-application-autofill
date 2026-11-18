import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

import { validateResume } from "@moyarich/resume/validate";
import { renderResumePdf } from "@moyarich/resume/create-pdf";

export async function generateResumePdf(input: unknown) {
  const profile = validateResume(input);
  return renderResumePdf(profile);
}

function extractWithQwen(executable: string, text: string): Promise<unknown> {
  const schema = fileURLToPath(
    import.meta.resolve("@moyarich/resume/resume.schema.json"),
  );
  return new Promise((resolve, reject) => {
    const child = execFile(
      executable,
      ["--schema", schema, "-"],
      { timeout: 120_000 },
      (error, stdout) => {
        if (error) {
          reject(
            new Error(
              "Local AI parsing failed. Check the server's Qwen setup or try the Standard parser.",
            ),
          );
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error("The local AI parser returned invalid JSON."));
        }
      },
    );
    child.stdin?.on("error", () => {
      reject(new Error("Could not send resume text to the local AI parser."));
    });
    child.stdin?.end(text);
  });
}

/** Dynamic import keeps resume extraction optional for JSON-only applicants. */
export async function parseResumeUpload(input: unknown) {
  const parser =
    input && typeof input === "object" && "parser" in input
      ? input.parser
      : "standard";
  if (parser !== "standard" && parser !== "qwen")
    throw new Error("Unknown resume parser.");

  const executable = process.env.RESUME_LLM_EXECUTABLE;
  if (parser === "qwen" && !executable)
    throw new Error(
      "Local AI parsing requires RESUME_LLM_EXECUTABLE on the server.",
    );

  const { decodeUpload, extractProfile, extractResumeText } =
    await import("@moyarich/resume");
  const upload = decodeUpload(input);
  const text = await extractResumeText(upload.buffer, upload.extension);
  const extracted = validateResume(
    executable && parser === "qwen"
      ? await extractWithQwen(executable, text)
      : extractProfile(text),
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
