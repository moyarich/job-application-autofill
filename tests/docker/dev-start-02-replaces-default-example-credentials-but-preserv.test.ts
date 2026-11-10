import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupEnv } from "../../docker/dev.ts";

describe("full development stack startup", () => {
  it("replaces default example credentials but preserves custom settings", () => {
    const dir = mkdtempSync(join(tmpdir(), "moya-dev-"));
    try {
      writeFileSync(
        join(dir, ".env"),
        "MOYA_WEB_PORT=5174\nWEB_VNC_PASSWORD=change-this-password\n",
      );
      setupEnv(dir, {}, () => "a1b2c3d4");
      const config = readFileSync(join(dir, ".env"), "utf8");
      expect(config).toContain("MOYA_WEB_PORT=5174");
      expect(config).toContain("WEB_VNC_PASSWORD=a1b2c3d4");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
