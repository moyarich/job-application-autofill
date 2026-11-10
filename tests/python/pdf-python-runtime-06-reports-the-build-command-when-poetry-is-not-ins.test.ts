import { describe, it, expect } from "vitest";
import { findPdfPython } from "../../packages/resume/src/extract-resume/python-runtime.ts";

describe("PDF Python environment resolution", () => {
  it("reports the build command when Poetry is not installed", async () => {
    const run = async () => {
      throw new Error("poetry not found");
    };
    await expect(
      findPdfPython({ env: {}, executeCommand: run }),
    ).rejects.toThrow(/npm run build:python/);
  });
});
