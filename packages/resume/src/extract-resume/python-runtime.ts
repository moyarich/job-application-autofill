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
 * Poetry is optional for Docker, but bootstrapped on demand on a developer host.
 */
export async function findPdfPython({
  env = process.env,
  executeCommand = execute,
  autoInstall = true,
}: {
  env?: NodeJS.ProcessEnv;
  executeCommand?: ExecuteCommand;
  autoInstall?: boolean;
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
  if (autoInstall) {
    try {
      await executeCommand(
        "poetry",
        ["install", "--only", "main", "--no-root"],
        { timeout: 300000, maxBuffer: 1024 * 1024 },
      );
      const installed = await poetryPython(executeCommand);
      if (installed && (await check(installed, executeCommand)))
        return installed;
    } catch (caught) {
      const error = caught as Error & { stderr?: string };
      const reason = error.stderr?.trim() || error.message;
      throw new Error(
        "Unable to initialize PDF extraction Python dependencies: " +
          reason.slice(0, 400) +
          ". Run npm run dev for the containerized app, or install Poetry for host development.",
        { cause: caught },
      );
    }
  }
  throw new Error(
    "Python PDF dependencies are unavailable. Start the complete app with npm run dev (Docker) or install Poetry for host development.",
  );
}
export function getPdfPython() {
  cached ??= findPdfPython().catch((error) => {
    cached = undefined;
    throw error;
  });
  return cached;
}
