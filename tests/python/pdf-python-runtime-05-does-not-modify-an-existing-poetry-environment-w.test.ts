import { describe, it, expect } from "vitest";
import { findPdfPython } from "../../packages/resume/src/extract-resume/python-runtime.ts";

describe("PDF Python environment resolution", () => {
  it("does not modify an existing Poetry environment when OCR modules are missing", async () => {
    const commands: string[] = [];
    const run = async (command: string, args: string[]) => {
      commands.push([command, ...args].join(" "));
      if (command === "poetry" && args[0] === "env")
        return { stdout: "/venv/python\n" };
      throw new Error("Missing pypdfium2");
    };
    await expect(
      findPdfPython({ env: {}, executeCommand: run }),
    ).rejects.toThrow(/npm run build:python/);
    expect(commands.filter((command) => command.startsWith("poetry "))).toEqual(
      ["poetry env info --executable"],
    );
  });
});
