import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (path: string) =>
  readFileSync(new URL("../../" + path, import.meta.url), "utf8");

const pages = "packages/job-application-autofill/src/pages/";

describe("workspace header actions", () => {
  it("is presentation-only and accepts optional actions from its page", () => {
    const header = source(
      "packages/job-application-autofill/src/components/WorkspaceHeader/WorkspaceHeader.tsx",
    );
    expect(header).toContain("actions?: ReactNode");
    expect(header).toContain("{actions &&");
    expect(header).not.toContain("ApplicationController");
    expect(header).not.toContain("setTab");
    expect(header).not.toContain("Import resume");
    expect(header).not.toContain("View applications");
  });

  it("defines page-specific actions inside pages rather than the app shell", () => {
    const app = source("packages/job-application-autofill/src/components/App/App.tsx");
    expect(app).not.toContain("<WorkspaceHeader");
    expect(app).not.toContain("pageHeaders");
    expect(app).not.toContain("Add application");
    const applications = source(pages + "applications/Applications.tsx");
    expect(applications).toContain("Add application");
    expect(applications).toContain('title="Applications"');
    for (const path of [
      "resumes/Resumes.tsx",
      "resumes/edit/ResumeEditor.tsx",
      "resumes/view/ResumeView.tsx",
      "resumes/import/ResumeImport.tsx",
      "profile/Profile.tsx",
      "workspace/Workspace.tsx",
    ]) {
      const page = source(pages + path);
      expect(page).toContain("<WorkspaceHeader");
      expect(page).not.toContain("actions={");
      expect(page).not.toContain("Add application");
    }
  });
});
