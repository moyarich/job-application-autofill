import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (path: string) =>
  readFileSync(new URL("../../" + path, import.meta.url), "utf8");

describe("Docker development configuration", () => {
  it("uses the development compose override for npm run dev", () => {
    const launcher = source("docker/dev.ts");
    expect(launcher).toContain('"docker-compose.dev.yml"');
    expect(launcher).toContain('"up", "--build", "--renew-anon-volumes"');
  });

  it("mounts local sources and restarts the API when code changes", () => {
    const override = source("docker-compose.dev.yml");
    expect(override).toContain("- .:/app");
    expect(override).toContain("- /app/node_modules");
    expect(override).toContain("- /app/packages/resume/dist");
    expect(override).toContain("- --watch");
    expect(override).toContain("CHOKIDAR_USEPOLLING");
    expect(override).toContain("./sqlite-data:/app/data");
  });

  it("keeps the base compose image-based for deployment-like runs", () => {
    const base = source("docker-compose.yml");
    expect(base).toContain("dockerfile: docker/Dockerfile");
    expect(base).not.toContain("- .:/app");
  });
});
