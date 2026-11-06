import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const source = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");


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
