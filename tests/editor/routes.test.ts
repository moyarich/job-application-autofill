import { describe, expect, it } from "vitest";
import {
  routes,
  pageRoutes,
  tabRoutes,
  tabForPath,
  applicationReviewPath,
  resumePath,
  resumeSwitchPath,
} from "../../packages/job-application-autofill/src/routes";

describe("centralized application routes", () => {
  it("declares every page in routes.ts", () => {
    expect(pageRoutes).toEqual([
      routes.applications,
      routes.profile,
      routes.contacts,
      routes.resumes,
      routes.resumeEditor,
      routes.resumeView,
      routes.resumeImport,
      routes.workspace,
    ]);
    expect(routes.applicationReview).toBe("/apply/:applicationId");
    expect(routes.applicationViewer).toBe("/application-viewer.html");
    expect(routes.contacts).toBe("/contacts");
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

});
