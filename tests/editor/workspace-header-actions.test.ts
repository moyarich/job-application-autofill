import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (path: string) =>
  readFileSync(new URL("../../" + path, import.meta.url), "utf8");

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

  it("supplies only an applications action from the app page", () => {
    const app = source("packages/job-application-autofill/src/components/App/App.tsx");
    expect(app).toContain("...pageHeaders[tab as keyof typeof pageHeaders]");
    expect(app).toContain('tab === "applications" ? (');
    expect(app).toContain("Add application");
    expect(app).not.toContain("View applications <");
  });
});
