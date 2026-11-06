// @ts-nocheck — migrated test fixtures retain runtime assertions.
import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const cli = new URL("../packages/resume/dist/extract-resume.js", import.meta.url).pathname;

describe("extract-resume CLI", () => {
  it("offers help and rejects missing or unknown arguments", () => {
    expect(execFileSync(process.execPath, [cli, "--help"], { encoding: "utf8" })).toContain("--output <file>");
    expect(spawnSync(process.execPath, [cli]).status).toBe(1);
    expect(spawnSync(process.execPath, [cli, "--unknown"]).status).toBe(1);
  });
  it("extracts DOCX through the real command and protects existing output", () => {
    const dir = mkdtempSync(join(tmpdir(), "resume-cli-"));
    try {
      const input = join(dir, "resume.docx"), output = join(dir, "resume.json");
      execFileSync("python3", ["-c", "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w'); z.writestr('word/document.xml','<w:document><w:p><w:t>Ada Lovelace</w:t></w:p><w:p><w:t>ada@example.com</w:t></w:p></w:document>'); z.close()", input]);
      const result = JSON.parse(execFileSync(process.execPath, [cli, input], { encoding: "utf8" }));
      expect(result.contact.email).toBe("ada@example.com");
      expect(result.source.fileName).toBe("resume.docx");
      execFileSync(process.execPath, [cli, input, "-o", output]);
      expect(JSON.parse(readFileSync(output, "utf8"))).toEqual(result);
      expect(spawnSync(process.execPath, [cli, input, "-o", output]).status).toBe(1);
      expect(execFileSync(process.execPath, [cli, input, "--text"], { encoding: "utf8" })).toContain("Ada Lovelace");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
