import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makePassword, parsePassword, setupEnv } from "../../docker/dev.ts";

describe("full development stack startup", () => {
  it("creates private VNC configuration and keeps it on subsequent runs", () => {
    const dir = mkdtempSync(join(tmpdir(), "moya-dev-"));
    try {
      expect(setupEnv(dir, {}, () => "a1b2c3d4").generated).toBe("a1b2c3d4");
      expect(parsePassword(readFileSync(join(dir, ".env"), "utf8"))).toBe("a1b2c3d4");
      if (process.platform !== "win32") expect(statSync(join(dir, ".env")).mode & 0o077).toBe(0);
      expect(setupEnv(dir, {}, () => "e1f2a3b4").generated).toBeNull();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  
  
  
});
