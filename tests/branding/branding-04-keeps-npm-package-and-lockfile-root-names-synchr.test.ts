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
  
  
});
