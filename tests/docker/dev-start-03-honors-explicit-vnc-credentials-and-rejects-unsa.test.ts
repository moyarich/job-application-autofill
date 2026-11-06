import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makePassword, parsePassword, setupEnv } from "../../docker/dev.ts";

describe("full development stack startup", () => {
  
  
  it("honors explicit VNC credentials and rejects unsafe passwords", () => {
    const dir = mkdtempSync(join(tmpdir(), "moya-dev-"));
    try {
      expect(setupEnv(dir, { WEB_VNC_PASSWORD: "safe-vnc-password" }).generated).toBeNull();
      expect(() => setupEnv(dir, { WEB_VNC_PASSWORD: "short" })).toThrow();
      expect(() => setupEnv(dir, { WEB_VNC_PASSWORD: "password" })).toThrow();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  
});
