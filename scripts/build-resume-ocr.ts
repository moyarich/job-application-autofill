#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = resolve(root, "packages/resume-ocr");
const venv = resolve(root, ".venv");
const python = resolve(
  venv,
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const requirements = resolve(root, "packages/resume-api/requirements.txt");
const version = readFileSync(requirements, "utf8").match(
  /^resume-ocr==([^\s]+)$/m,
)?.[1];
if (!version) throw new Error("The API must pin a resume-ocr version.");

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      VIRTUAL_ENV: venv,
      POETRY_VIRTUALENVS_CREATE: "false",
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} exited with status ${result.status}`);
}

try {
  if (!existsSync(python))
    run(process.platform === "win32" ? "python" : "python3", [
      "-m",
      "venv",
      venv,
    ]);
  run(python, [
    "-c",
    "import sys; assert (3, 12) <= sys.version_info[:2] < (3, 15), 'resume-ocr requires Python 3.12-3.14'",
  ]);
  const wheels = resolve(packageDir, "dist");
  run(process.env.POETRY_EXECUTABLE || "poetry", [
    "--directory",
    packageDir,
    "build",
    "--format",
    "wheel",
  ]);
  const wheel = resolve(wheels, `resume_ocr-${version}-py3-none-any.whl`);
  if (!existsSync(wheel))
    throw new Error("The built wheel does not match the API's pinned version.");
  run(python, [
    "-m",
    "pip",
    "install",
    "--no-deps",
    "--no-index",
    "--force-reinstall",
    wheel,
  ]);
  run(python, [
    "-m",
    "pip",
    "install",
    "--find-links",
    wheels,
    "-r",
    requirements,
  ]);
  console.log(
    `Installed resume-ocr ${version}. Set PYTHON_EXECUTABLE=${python}`,
  );
} catch (error) {
  console.error(
    `Python/OCR build failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
