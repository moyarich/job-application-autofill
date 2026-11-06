// @ts-nocheck — migrated test fixtures retain runtime assertions.
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makePassword, parsePassword, setupEnv } from "../docker/dev.ts";

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
  it("replaces default example credentials but preserves custom settings", () => {
    const dir = mkdtempSync(join(tmpdir(), "moya-dev-"));
    try {
      writeFileSync(join(dir, ".env"), "MOYA_WEB_PORT=5174\nWEB_VNC_PASSWORD=change-this-password\n");
      setupEnv(dir, {}, () => "a1b2c3d4");
      const config = readFileSync(join(dir, ".env"), "utf8");
      expect(config).toContain("MOYA_WEB_PORT=5174");
      expect(config).toContain("WEB_VNC_PASSWORD=a1b2c3d4");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("honors explicit VNC credentials and rejects unsafe passwords", () => {
    const dir = mkdtempSync(join(tmpdir(), "moya-dev-"));
    try {
      expect(setupEnv(dir, { WEB_VNC_PASSWORD: "safe-vnc-password" }).generated).toBeNull();
      expect(() => setupEnv(dir, { WEB_VNC_PASSWORD: "short" })).toThrow();
      expect(() => setupEnv(dir, { WEB_VNC_PASSWORD: "password" })).toThrow();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("generates eight-character credentials and parses quoted values", () => {
    expect(makePassword(Buffer.from("1234567890"))).toMatch(/^[A-Za-z0-9_-]{8}$/);
    expect(parsePassword('WEB_VNC_PASSWORD="secure-password"')).toBe("secure-password");
  });
});
