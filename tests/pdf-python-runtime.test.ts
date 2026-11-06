import { describe, it, expect } from "vitest";
import { findPdfPython } from "../packages/resume/scripts/python-runtime.ts";

describe("PDF Python environment resolution", () => {
  it("uses an explicitly configured and verified interpreter", async () => {
    const calls: string[][] = [];
    const run = async (command: string, args: string[]) => {
      calls.push([command, ...args]);
      return { stdout: "" };
    };
    expect(
      await findPdfPython({
        env: { PYTHON_EXECUTABLE: "/opt/venv/bin/python" },
        executeCommand: run,
      }),
    ).toBe("/opt/venv/bin/python");
    expect(calls).toHaveLength(1);
  });
  it("does not silently use system Python when explicitly selected interpreter is broken", async () => {
    const run = async () => {
      throw new Error("No module named pypdfium2");
    };
    await expect(
      findPdfPython({
        env: { PYTHON_EXECUTABLE: "/bad/python" },
        executeCommand: run,
      }),
    ).rejects.toThrow(/Configured PYTHON_EXECUTABLE/);
  });
  it("prefers an existing Poetry virtualenv over system python", async () => {
    const run = async (command: string, args: string[]) => {
      if (command === "poetry" && args[0] === "env")
        return {
          stdout: "/home/user/.cache/pypoetry/virtualenvs/moya/bin/python\n",
        };
      if (command.includes("virtualenvs")) return { stdout: "" };
      throw new Error("system unavailable");
    };
    expect(await findPdfPython({ env: {}, executeCommand: run })).toContain(
      "virtualenvs",
    );
  });
  it("never provisions dependencies during interpreter discovery", async () => {
    const commands: string[] = [];
    const run = async (command: string, args: string[]) => {
      commands.push([command, ...args].join(" "));
      throw new Error("missing");
    };
    await expect(findPdfPython({ env: {}, executeCommand: run })).rejects.toThrow(
      /npm run build:python --workspace packages\\/resume/,
    );
    expect(commands).toContain("poetry env info --executable");
    expect(commands).toContain("python3 -c import pypdfium2; from rapidocr import RapidOCR; import onnxruntime; from PIL import Image");
    expect(commands.some(command => /\\b(install|venv|pip)\\b/.test(command))).toBe(false);
  });
  it("does not modify an existing Poetry environment when OCR modules are missing", async () => {
    const commands: string[] = [];
    const run = async (command: string, args: string[]) => {
      commands.push([command, ...args].join(" "));
      if (command === "poetry" && args[0] === "env") return { stdout: "/venv/python\\n" };
      throw new Error("Missing pypdfium2");
    };
    await expect(findPdfPython({ env: {}, executeCommand: run })).rejects.toThrow(
      /npm run build:python/,
    );
    expect(commands.filter(command => command.startsWith("poetry "))).toEqual([
      "poetry env info --executable",
    ]);
  });
  it("reports the build command when Poetry is not installed", async () => {
    const run = async () => { throw new Error("poetry not found"); };
    await expect(findPdfPython({ env: {}, executeCommand: run })).rejects.toThrow(
      /npm run build:python/,
    );
  });
});
