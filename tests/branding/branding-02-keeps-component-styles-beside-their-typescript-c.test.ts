import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";


const source = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");


describe("job-application-autofill application naming", () => {
  
  it("keeps component styles beside their TypeScript components", () => {
    const appRoot = "packages/job-application-autofill/src/App";
    expect(source(appRoot + ".tsx")).toContain('import "./App.css"');
    expect(source(appRoot + ".css").trim().length).toBeGreaterThan(0);
    for (const name of ["ApplicationReview", "CandidateProfile", "Opportunities", "ResumeParser", "Sidebar", "WorkspaceHeader"]) {
      const base = `packages/job-application-autofill/src/components/${name}/${name}`;
      expect(source(base + ".tsx"), name).toContain(`import "./${name}.css"`);
      expect(source(base + ".css").trim().length, name).toBeGreaterThan(0);
    }
  });
  
  
  
  
});
