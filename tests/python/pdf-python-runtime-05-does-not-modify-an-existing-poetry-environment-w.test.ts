import { describe, it, expect } from "vitest";
import { findPdfPython } from "../../packages/resume/src/extract-resume/python-runtime.ts";

describe("PDF Python environment resolution", () => {
  it("does not look up a source checkout or Poetry environment at runtime", async () => {
    const commands: string[] = [];
    const run = async (command: string, args: string[]) => {
      commands.push([command, ...args].join(" "));
      throw new Error("Missing pypdfium2");
    };
    await expect(
      findPdfPython({ env: {}, executeCommand: run }),
    ).rejects.toThrow();
    expect(commands).toHaveLength(2);
    expect(commands.every((command) => /^python3? -c /.test(command))).toBe(
      true,
    );
    expect(commands.join(" ")).not.toMatch(/poetry|resume-ocr[\\/]/);
  });
});
