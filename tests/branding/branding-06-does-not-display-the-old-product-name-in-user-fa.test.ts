import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";


const source = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");


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
