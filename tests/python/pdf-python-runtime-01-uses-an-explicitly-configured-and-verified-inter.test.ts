import { describe, it, expect } from "vitest";
import { findPdfPython } from "../../packages/resume/src/extract-resume/python-runtime.ts";

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
    expect(calls.length).toBeGreaterThan(0);
  });
});
