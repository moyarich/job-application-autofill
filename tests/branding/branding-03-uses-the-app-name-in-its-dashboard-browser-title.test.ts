import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";


const source = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");


describe("job-application-autofill application naming", () => {
  
  
  it("uses the app name in its dashboard, browser title and launcher", () => {
    expect(source("packages/job-application-autofill/index.html")).toContain("<title>job-application-autofill");
    expect(source("packages/job-application-autofill/src/components/Sidebar/Sidebar.tsx")).toContain("job-application-");
    expect(source("packages/job-application-autofill/src/components/Sidebar/Sidebar.tsx")).toContain(">autofill</span>");
    expect(source("docker/dev.ts")).toContain("Starting job-application-autofill");
    expect(source("packages/resume-api/index.ts")).toContain("job-application-autofill local API");
  });
  
  
  
});
