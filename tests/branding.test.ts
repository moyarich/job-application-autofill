import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const source = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");


const ignoredDirs = new Set(["node_modules", ".git", "dist", "dist-app", "coverage", "sqlite-data", ".cache"]);
function legacyModuleFiles(directory: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filename = join(directory, entry.name);
    if (entry.isDirectory() && !ignoredDirs.has(entry.name)) result.push(...legacyModuleFiles(filename));
    else if (entry.isFile() && entry.name.endsWith(".mjs")) result.push(filename);
  }
  return result;
}

describe("job-application-autofill application naming", () => {
  it("contains no repository-owned .mjs modules", () => {
    expect(legacyModuleFiles(fileURLToPath(new URL("..", import.meta.url)))).toEqual([]);
  });
  it("keeps component styles beside their TypeScript components", () => {
    for (const name of ["App", "ApplicationReview", "CandidateProfile", "Opportunities", "ResumeParser", "Sidebar", "WorkspaceHeader"]) {
      const base = `packages/job-application-autofill/src/components/${name}/${name}`;
      expect(source(base + ".tsx"), name).toContain(`import "./${name}.css"`);
      expect(source(base + ".css").trim().length, name).toBeGreaterThan(0);
    }
  });
  it("uses the app name in its dashboard, browser title and launcher", () => {
    expect(source("packages/job-application-autofill/index.html")).toContain("<title>job-application-autofill");
    expect(source("packages/job-application-autofill/src/components/Sidebar/Sidebar.tsx")).toContain("job-application-");
    expect(source("packages/job-application-autofill/src/components/Sidebar/Sidebar.tsx")).toContain(">autofill</span>");
    expect(source("docker/dev.ts")).toContain("Starting job-application-autofill");
    expect(source("packages/resume-api/index.ts")).toContain("job-application-autofill local API");
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
    expect(source("packages/resume-api/store.ts")).toContain("data/moyaapply.sqlite");
  });
  it("does not display the old product name in user-facing entry points", () => {
    for (const file of [
      "README.md",
      "apps/playground/index.html",
      "apps/playground/src/main.tsx",
      "packages/resume-api/index.ts",
      "docker/dev.ts",
      "packages/resume/README.md",
      "packages/job-application-autofill/README.md",
      "packages/resume/src/resume-schema/README.md",
    ]) expect(source(file), file).not.toMatch(/MoyaApply/);
  });
});
