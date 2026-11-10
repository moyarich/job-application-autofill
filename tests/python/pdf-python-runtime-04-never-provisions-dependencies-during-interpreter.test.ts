import { describe, it, expect } from "vitest";
import { findPdfPython } from "../../packages/resume/src/extract-resume/python-runtime.ts";

describe("PDF Python environment resolution", () => {
  it("never provisions dependencies during interpreter discovery", async () => {
    const commands: string[] = [];
    const run = async (command: string, args: string[]) => {
      commands.push([command, ...args].join(" "));
      throw new Error("missing");
    };
    await expect(
      findPdfPython({ env: {}, executeCommand: run }),
    ).rejects.toThrow(/npm run build:python --workspace packages\/resume/);
    expect(commands).toContain("poetry env info --executable");
    expect(commands).toContain(
      "python3 -c import pypdfium2; from rapidocr import RapidOCR; import onnxruntime; from PIL import Image",
    );
    expect(
      commands.some((command) => /\b(install|venv|pip)\b/.test(command)),
    ).toBe(false);
  });
});
