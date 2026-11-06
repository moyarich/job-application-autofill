import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";


const source = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");


const ignoredDirs = new Set(["node_modules", ".git", "dist", "dist-app", "coverage", "sqlite-data", ".cache"]);

describe("job-application-autofill application naming", () => {
  
  it("keeps component styles beside their TypeScript components", () => {
    for (const name of ["App", "ApplicationReview", "CandidateProfile", "Opportunities", "ResumeParser", "Sidebar", "WorkspaceHeader"]) {
      const base = `packages/job-application-autofill/src/components/${name}/${name}`;
      expect(source(base + ".tsx"), name).toContain(`import "./${name}.css"`);
      expect(source(base + ".css").trim().length, name).toBeGreaterThan(0);
    }
  });
  
  
  
  
});
