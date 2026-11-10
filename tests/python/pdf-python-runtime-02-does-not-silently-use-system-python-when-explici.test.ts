import { describe, it, expect } from "vitest";
import { findPdfPython } from "../../packages/resume/src/extract-resume/python-runtime.ts";

describe("PDF Python environment resolution", () => {
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
});
