import { readFile, access } from "node:fs/promises";
import { beforeEach, expect, it, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("node:child_process", () => ({
  execFile: Object.assign(vi.fn(), {
    [Symbol.for("nodejs.util.promisify.custom")]: execute,
  }),
}));
vi.mock("../../packages/resume/src/extract-resume/python-runtime.ts", () => ({
  getPdfPython: async () => "/installed/venv/bin/python",
}));
import { extractResumeText } from "../../packages/resume/src/extract-resume/index.ts";

beforeEach(() => {
  execute.mockReset();
});

it("invokes the installed module and removes the temporary PDF after success", async () => {
  const input = Buffer.from("%PDF-1.4 test");
  execute.mockImplementation(async (_python, args) => {
    expect(await readFile(args[2])).toEqual(input);
    return {
      stdout: JSON.stringify({
        text: "Ada Lovelace",
        ocrPages: [],
        pageCount: 1,
      }),
    };
  });
  await expect(extractResumeText(input, "pdf")).resolves.toBe("Ada Lovelace");
  const [python, args, options] = execute.mock.calls[0];
  expect(python).toBe("/installed/venv/bin/python");
  expect(args.slice(0, 2)).toEqual(["-m", "resume_ocr"]);
  expect(args).toHaveLength(3);
  expect(options.shell).toBeUndefined();
  await expect(access(args[2])).rejects.toThrow();
});

it("cleans up and reports malformed output from the installed package", async () => {
  execute.mockResolvedValue({ stdout: "not JSON" });
  await expect(
    extractResumeText(Buffer.from("%PDF-test"), "pdf"),
  ).rejects.toThrow("PDF extraction produced an invalid response");
  await expect(access(execute.mock.calls[0][1][2])).rejects.toThrow();
});

it("cleans up and reports extraction errors from stderr", async () => {
  execute.mockRejectedValue(
    Object.assign(new Error("failed"), { stderr: "Invalid PDF" }),
  );
  await expect(
    extractResumeText(Buffer.from("%PDF-test"), "pdf"),
  ).rejects.toThrow("PDF extraction failed: Invalid PDF");
  await expect(access(execute.mock.calls[0][1][2])).rejects.toThrow();
});
