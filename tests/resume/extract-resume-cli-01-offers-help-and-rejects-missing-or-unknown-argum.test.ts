import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const cli = new URL("../../packages/resume/dist/extract-resume.js", import.meta.url).pathname;

describe("extract-resume CLI", () => {
  it("offers help and rejects missing or unknown arguments", () => {
    expect(execFileSync(process.execPath, [cli, "--help"], { encoding: "utf8" })).toContain("--output <file>");
    expect(spawnSync(process.execPath, [cli]).status).toBe(1);
    expect(spawnSync(process.execPath, [cli, "--unknown"]).status).toBe(1);
  });
  
});
