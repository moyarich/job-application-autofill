import { execFile, type ExecFileOptions } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const run = promisify(execFile);
export function resumePackageDir() {
  let directory = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(resolve(directory, "package.json"))) {
    const parent = dirname(directory);
    if (parent === directory)
      throw new Error("Resume package configuration not found.");
    directory = parent;
  }
  return directory;
}
const dependencyProbe =
  "import resume_ocr; import pypdfium2; from rapidocr import RapidOCR; import onnxruntime; from PIL import Image";
type ExecuteCommand = (
  command: string,
  args: string[],
  options?: ExecFileOptions,
) => Promise<{ stdout: string }>;
let cached: Promise<string> | undefined;
async function execute(
  command: string,
  args: string[],
  options: ExecFileOptions = {},
) {
  return run(command, args, {
    cwd: tmpdir(),
    timeout: 12000,
    windowsHide: true,
    ...options,
    encoding: "utf8",
  });
}
async function check(python: string, executeCommand: ExecuteCommand) {
  try {
    await executeCommand(python, ["-c", dependencyProbe], {
      timeout: 12000,
      cwd: tmpdir(),
    });
    return true;
  } catch {
    return false;
  }
}
/**
 * Resolve the interpreter that actually has the PDFium/OCR dependencies.
 * Provisioning is exclusively the responsibility of scripts/build-resume-ocr.ts.
 * Runtime detection never installs packages or modifies an environment.
 */
export async function findPdfPython({
  env = process.env,
  executeCommand = execute,
}: {
  env?: NodeJS.ProcessEnv;
  executeCommand?: ExecuteCommand;
} = {}) {
  const explicit = env.PYTHON_EXECUTABLE?.trim();
  if (explicit) {
    if (await check(explicit, executeCommand)) return explicit;
    throw new Error(
      "Configured PYTHON_EXECUTABLE is missing the installed resume-ocr package or PDF dependencies: " +
        explicit +
        ". Check the selected environment or rebuild the Docker image.",
    );
  }
  for (const python of ["python3", "python"]) {
    if (await check(python, executeCommand)) return python;
  }
  throw new Error(
    "Python PDF dependencies are unavailable. Install the versioned resume-ocr dependency in your Python environment and set PYTHON_EXECUTABLE to that interpreter, or start the containerized app with npm run dev.",
  );
}
export function getPdfPython() {
  cached ??= findPdfPython().catch((error) => {
    cached = undefined;
    throw error;
  });
  return cached;
}
