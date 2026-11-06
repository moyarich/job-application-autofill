import { execFile, type ExecFileOptions } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const run = promisify(execFile);
export function resumePackageDir() {
  let directory = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(resolve(directory, "pyproject.toml"))) {
    const parent = dirname(directory);
    if (parent === directory) throw new Error("Resume package Python configuration not found.");
    directory = parent;
  }
  return directory;
}
const packageDir = resumePackageDir();
const dependencyProbe =
  "import pypdfium2; from rapidocr import RapidOCR; import onnxruntime; from PIL import Image";
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
    cwd: packageDir,
    timeout: 12000,
    windowsHide: true,
    ...options,
    encoding: "utf8",
  });
}
async function check(python: string, executeCommand: ExecuteCommand) {
  try {
    await executeCommand(python, ["-c", dependencyProbe], { timeout: 12000 });
    return true;
  } catch {
    return false;
  }
}
async function poetryPython(executeCommand: ExecuteCommand) {
  try {
    const { stdout } = await executeCommand(
      "poetry",
      ["env", "info", "--executable"],
      { timeout: 12000 },
    );
    return stdout.trim();
  } catch {
    return "";
  }
}
/**
 * Resolve the interpreter that actually has the PDFium/OCR dependencies.
 * Provisioning is exclusively the responsibility of scripts/build-python.ts.
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
      "Configured PYTHON_EXECUTABLE is missing PDF dependencies: " +
        explicit +
        ". Check the selected environment or rebuild the Docker image.",
    );
  }
  const managed = await poetryPython(executeCommand);
  if (managed && (await check(managed, executeCommand))) return managed;
  for (const python of ["python3", "python"]) {
    if (await check(python, executeCommand)) return python;
  }
  throw new Error(
    "Python PDF dependencies are unavailable. Run npm run build:python --workspace packages/resume to provision the OCR environment, or start the containerized app with npm run dev. Set PYTHON_EXECUTABLE to an existing interpreter with PDF/OCR dependencies if needed.",
  );
}
export function getPdfPython() {
  cached ??= findPdfPython().catch((error) => {
    cached = undefined;
    throw error;
  });
  return cached;
}
