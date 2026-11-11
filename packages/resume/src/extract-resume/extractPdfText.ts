import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getPdfPython } from "./python-runtime.ts";

const execFileAsync = promisify(execFile);

export async function extractPdfText(buffer: Buffer) {
  // Python PDFium extracts selectable text and invokes RapidOCR only for scanned pages.
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "moya-resume-"));
  try {
    const input = join(dir, "resume.pdf");
    await writeFile(input, buffer, { mode: 0o600 });
    const python = await getPdfPython();
    const { stdout } = await execFileAsync(
      python,
      ["-m", "resume_ocr", input],
      {
        timeout: 120000,
        maxBuffer: 15 * 1024 * 1024,
        windowsHide: true,
      },
    );
    let result;
    try {
      result = JSON.parse(stdout);
    } catch (error) {
      throw new Error("PDF extraction produced an invalid response.", {
        cause: error,
      });
    }
    if (typeof result.text !== "string" || !result.text.trim())
      throw new Error("PDF extraction found no readable text.");
    return result.text;
  } catch (caught) {
    const error = caught as Error & {
      code?: string;
      killed?: boolean;
      stderr?: string;
    };
    if (error.code === "ENOENT")
      throw new Error(
        "Python is required for PDF extraction. Set PYTHON_EXECUTABLE to your virtual environment's Python executable.",
        { cause: caught },
      );
    if (error.killed || error.code === "ETIMEDOUT")
      throw new Error("PDF extraction exceeded the 120-second timeout.", {
        cause: caught,
      });
    if (error.stderr)
      throw new Error(
        `PDF extraction failed: ${error.stderr.toString().trim().slice(0, 700)}`,
        { cause: caught },
      );
    throw error;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
