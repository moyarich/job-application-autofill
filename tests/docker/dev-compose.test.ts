import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (path: string) =>
  readFileSync(new URL("../../" + path, import.meta.url), "utf8");

describe("Docker development configuration", () => {
  it("uses the development compose override for npm run dev", () => {
    const launcher = source("docker/dev.ts");
    expect(launcher).toContain('"docker-compose.dev.yml"');
    expect(launcher).toContain('...(rebuild ? ["--build", "--renew-anon-volumes"] : [])');
    expect(launcher).toContain('const rebuild = process.argv.slice(2).includes("--build")');
    expect(launcher).not.toContain('"up", "--build", "--renew-anon-volumes"');
  });

  it("mounts local sources and restarts the API when code changes", () => {
    const override = source("docker-compose.dev.yml");
    expect(override).toContain('entrypoint: ["bash", "/app/docker/start-review.sh"]');
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
    expect(base).toContain("target: api");
    expect(base).toContain("target: web");
    expect(base).toContain("image: job-application-autofill-api:local");
    expect(base).toContain("image: job-application-autofill-web:local");
    expect(base).not.toContain("- .:/app");
  });
  it("keeps browsers and Python out of the frontend Docker target", () => {
    const dockerfile = source("docker/Dockerfile");
    expect(dockerfile).toContain("FROM build AS web");
    expect(dockerfile).toContain("playwright install --with-deps chromium");
    expect(dockerfile).not.toContain("mcr.microsoft.com/playwright:");
    const apiStage = dockerfile.match(/^FROM\s+\S+\s+AS api\s*$/m);
    expect(apiStage).not.toBeNull();
    expect(dockerfile.indexOf("FROM build AS web")).toBeLessThan(
      dockerfile.indexOf(apiStage![0]),
    );
  });

});
