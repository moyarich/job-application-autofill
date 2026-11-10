import { describe, it, expect } from "vitest";
import { findPdfPython } from "../../packages/resume/src/extract-resume/python-runtime.ts";

describe("PDF Python environment resolution", () => {
  
  
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
  
  
  
});
