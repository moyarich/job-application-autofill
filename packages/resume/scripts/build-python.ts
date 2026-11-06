#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import type { SpawnSyncOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const poetryEnv = join(packageDir, "node_modules", ".cache", "poetry");
const poetryBin = join(poetryEnv, process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "poetry.exe" : "poetry");

type ExecuteOptions = SpawnSyncOptions & { allowMissing?: boolean };
function execute(command: string, args: string[], options: ExecuteOptions = {}): boolean {
  const result = spawnSync(command, args, {
    cwd: packageDir,
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
  if (result.error) {
    if (options.allowMissing && (result.error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw new Error(`Unable to execute ${command}: ${result.error.message}`, { cause: result.error });
  }
  if (result.status !== 0) {
    if (options.allowMissing) return false;
    throw new Error(`${command} exited with status ${result.status ?? "unknown"}`);
  }
  return true;
}

function pythonVersionOk(python: string): boolean {
  const result = spawnSync(python, [
    "-c",
    "import sys; sys.exit(0 if (3, 12) <= sys.version_info[:2] < (3, 15) else 1)",
  ], { windowsHide: true, stdio: "ignore" });
  return !result.error && result.status === 0;
}

function selectPython(): string | string[] {
  const candidates = [
    process.env.PYTHON_EXECUTABLE,
    "python3.14",
    "python3.13",
    "python3.12",
    "python3",
    "python",
  ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
  for (const candidate of candidates) {
    if (pythonVersionOk(candidate)) return candidate;
  }
  if (process.platform === "win32") {
    for (const version of ["3.14", "3.13", "3.12"]) {
      const result = spawnSync("py", ["-" + version, "-c",
        "import sys; sys.exit(0 if (3, 12) <= sys.version_info[:2] < (3, 15) else 1)",
      ], { windowsHide: true, stdio: "ignore" });
      if (!result.error && result.status === 0) return ["py", "-" + version];
    }
  }
  throw new Error("Python 3.12, 3.13, or 3.14 is required for PDF/OCR dependencies.");
}

function runPython(python: string | string[], args: string[]): boolean {
  if (Array.isArray(python)) return execute(python[0], [...python.slice(1), ...args]);
  return execute(python, args);
}

function ensurePoetry(): string {
  if (execute("poetry", ["--version"], { stdio: "ignore", allowMissing: true })) return "poetry";
  if (existsSync(poetryBin) && execute(poetryBin, ["--version"], { stdio: "ignore", allowMissing: true })) return poetryBin;

  console.log("Poetry was not found; installing it in a project-local virtual environment.");
  const python = selectPython();
  runPython(python, ["-m", "venv", poetryEnv]);
  const venvPython = join(poetryEnv, process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python");
  execute(venvPython, ["-m", "pip", "install", "--disable-pip-version-check", "poetry>=2.1,<3"]);
  if (!existsSync(poetryBin)) throw new Error("Poetry installation did not create its executable.");
  return poetryBin;
}

try {
  const poetry = ensurePoetry();
  const python = selectPython();
  if (!Array.isArray(python)) execute(poetry, ["env", "use", python]);
  execute(poetry, ["install", "--only", "main", "--no-root", "--no-interaction"]);
} catch (error) {
  console.error(`Python/OCR build failed: ${${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
