import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ignoredDirs = new Set([
  "node_modules",
  ".git",
  "dist",
  "dist-app",
  "coverage",
  "sqlite-data",
  ".cache",
]);
function legacyModuleFiles(directory: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filename = join(directory, entry.name);
    if (entry.isDirectory() && !ignoredDirs.has(entry.name))
      result.push(...legacyModuleFiles(filename));
    else if (entry.isFile() && entry.name.endsWith(".mjs"))
      result.push(filename);
  }
  return result;
}

describe("job-application-autofill application naming", () => {
  it("contains no repository-owned .mjs modules", () => {
    expect(
      legacyModuleFiles(fileURLToPath(new URL("../..", import.meta.url))),
    ).toEqual([]);
  });
});
