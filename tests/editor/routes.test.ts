import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  routes,
  pageRoutes,
  tabRoutes,
  tabForPath,
  applicationReviewPath,
  resumePath,
  resumeSwitchPath,
} from "../../packages/job-application-autofill/src/routes";

const frontend = "packages/job-application-autofill/src/";
const source = (path: string) =>
  readFileSync(new URL("../../" + frontend + path, import.meta.url), "utf8");

describe("centralized application routes", () => {
  it("declares every page in routes.ts", () => {
    expect(pageRoutes).toEqual([
      routes.applications,
      routes.profile,
      routes.resumes,
      routes.resumeEditor,
      routes.resumeView,
      routes.resumeImport,
      routes.workspace,
    ]);
    expect(routes.applicationReview).toBe("/apply/:applicationId");
    expect(routes.applicationViewer).toBe("/application-viewer.html");
  });

  it("does not retain legacy resume redirects", () => {
    const router = source("router.tsx");
    expect(router).not.toContain("LegacyResumeRedirect");
    expect(router).not.toContain('path: "/resume"');
    expect(router).not.toContain('path: "/import"');
    expect(router).toContain("pageRoutes.map");
    expect(router).toContain("routes.applicationReview");
  });

  it("uses the same route table for navigation and tab state", () => {
    for (const [tab, path] of Object.entries(tabRoutes)) {
      expect(tabForPath(path)).toBe(tab);
    }
    expect(resumePath("edit")).toBe(routes.resumeEditor);
    expect(resumePath("view")).toBe(routes.resumeView);
    expect(resumeSwitchPath(routes.resumeEditor)).toBe(routes.resumeEditor);
    expect(resumeSwitchPath(routes.applications)).toBe(routes.workspace);
    expect(applicationReviewPath("job a/b")).toBe("/apply/job%20a%2Fb");
  });

  it("does not redefine application paths in the router or stored-record hook", () => {
    expect(source("router.tsx")).not.toMatch(/path:\s*["']\//);
    expect(source("hooks/useStoredRecord.ts")).not.toContain('location.pathname === "/');
  });
});
