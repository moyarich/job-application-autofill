import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const source = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

describe("job-application-autofill application naming", () => {
  it("uses the app name in its dashboard, browser title and launcher", () => {
    expect(source("apps/playground/index.html")).toContain("<title>job-application-autofill");
    expect(source("apps/playground/src/main.tsx")).toContain("job-application-");
    expect(source("apps/playground/src/main.tsx")).toContain(">autofill</span>");
    expect(source("scripts/dev.mjs")).toContain("Starting job-application-autofill");
    expect(source("packages/resume-api/index.mjs")).toContain("job-application-autofill local API");
  });
  it("keeps npm package and lockfile root names synchronized", () => {
    const pkg = JSON.parse(source("package.json"));
    const lock = JSON.parse(source("package-lock.json"));
    expect(pkg.name).toBe("job-application-autofill");
    expect(lock.name).toBe(pkg.name);
    expect(lock.packages[""].name).toBe(pkg.name);
    const playground = JSON.parse(source("apps/playground/package.json"));
    expect(playground.name).toBe("@job-application-autofill/playground");
    expect(lock.packages["apps/playground"].name).toBe(playground.name);
    expect(lock.packages["node_modules/@job-application-autofill/playground"]).toBeDefined();
  });
  it("persists SQLite in the host bind mount and retains its database filename", () => {
    expect(source("docker-compose.yml")).toContain("name: moyaapply");
    expect(source("docker-compose.yml")).toContain("./sqlite-data:/app/data");
    expect(source("packages/resume-api/store.mjs")).toContain("data/moyaapply.sqlite");
  });
  it("does not display the old product name in user-facing entry points", () => {
    for (const file of [
      "README.md",
      "apps/playground/index.html",
      "apps/playground/src/main.tsx",
      "packages/resume-api/index.mjs",
      "scripts/dev.mjs",
      "packages/resume/README.md",
      "packages/job-application-autofill/README.md",
      "packages/resume/src/resume-schema/README.md",
    ]) expect(source(file), file).not.toMatch(/MoyaApply/);
  });
});
