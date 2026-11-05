import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const run = promisify(execFile);
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dependencyProbe = "import pypdfium2; from rapidocr import RapidOCR; import onnxruntime; from PIL import Image";
let cached;
async function execute(command, args, options = {}) {
  return run(command, args, { cwd: packageDir, timeout: 12000, windowsHide: true, ...options });
}
async function check(python, executeCommand) {
  try {
    await executeCommand(python, ["-c", dependencyProbe], { timeout: 12000 });
    return true;
  } catch { return false; }
}
async function poetryPython(executeCommand) {
  try {
    const { stdout } = await executeCommand("poetry", ["env", "info", "--executable"], { timeout: 12000 });
    return stdout.trim();
  } catch { return ""; }
}
/**
 * Resolve the interpreter that actually has the PDFium/OCR dependencies.
 * Poetry is optional for Docker, but bootstrapped on demand on a developer host.
 */
export async function findPdfPython({ env = process.env, executeCommand = execute, autoInstall = true } = {}) {
  const explicit = env.PYTHON_EXECUTABLE?.trim();
  if (explicit) {
    if (await check(explicit, executeCommand)) return explicit;
    throw new Error("Configured PYTHON_EXECUTABLE is missing PDF dependencies: " + explicit +
      ". Check the selected environment or rebuild the Docker image.");
  }
  const managed = await poetryPython(executeCommand);
  if (managed && await check(managed, executeCommand)) return managed;
  for (const python of ["python3", "python"]) {
    if (await check(python, executeCommand)) return python;
  }
  if (autoInstall) {
    try {
      await executeCommand("poetry", ["install", "--only", "main", "--no-root"], { timeout: 300000, maxBuffer: 1024 * 1024 });
      const installed = await poetryPython(executeCommand);
      if (installed && await check(installed, executeCommand)) return installed;
    } catch (error) {
      const reason = error.stderr?.trim() || error.message;
      throw new Error("Unable to initialize PDF extraction Python dependencies: " + reason.slice(0, 400) +
        ". Run npm run dev for the containerized app, or install Poetry for host development.", { cause: error });
    }
  }
  throw new Error("Python PDF dependencies are unavailable. Start the complete app with npm run dev (Docker) or install Poetry for host development.");
}
export function getPdfPython() {
  cached ??= findPdfPython().catch(error => { cached = undefined; throw error; });
  return cached;
}
