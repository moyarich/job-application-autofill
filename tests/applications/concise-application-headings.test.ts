import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const source = (path: string) => readFileSync(
  new URL("../../packages/job-application-autofill/src/" + path, import.meta.url),
  "utf8",
);

test("application titles explain their sections without redundant subtitles", () => {
  const app = source("pages/applications/PageApplications.tsx");
  const opportunities = source("components/Opportunities/Opportunities.tsx");
  const header = source("components/WorkspaceHeader/WorkspaceHeader.tsx");

  expect(app).toContain('title="Applications"');
  expect(app).not.toContain('description="Organize your job search');
  expect(opportunities).toContain("<h2>Add a job application</h2>");
  expect(opportunities).toContain("<h2>Your job applications</h2>");
  expect(opportunities).not.toContain("Save the details of a role");
  expect(opportunities).not.toContain("Keep track of every stage");
  expect(header).toContain("description?: string;");
  expect(header).toContain("{description && <p>{description}</p>}");
});
