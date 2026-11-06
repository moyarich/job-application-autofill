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
  
  
  it("uses the app name in its dashboard, browser title and launcher", () => {
    expect(source("packages/job-application-autofill/index.html")).toContain("<title>job-application-autofill");
    expect(source("packages/job-application-autofill/src/components/Sidebar/Sidebar.tsx")).toContain("job-application-");
    expect(source("packages/job-application-autofill/src/components/Sidebar/Sidebar.tsx")).toContain(">autofill</span>");
    expect(source("docker/dev.ts")).toContain("Starting job-application-autofill");
    expect(source("packages/resume-api/index.ts")).toContain("job-application-autofill local API");
  });
  
  
  
});
