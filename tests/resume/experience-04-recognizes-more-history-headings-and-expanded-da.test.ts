import { describe, expect, it } from "vitest";
import { extractEmploymentHistory } from "@moyarich/resume";
describe("employment history", () => {
  it("recognizes more history headings and expanded date separators", () => {
    const jobs = extractEmploymentHistory(
      "Professional Background\nExample Technologies\nPrincipal Engineer\n2020-01—2024-02\n• Led platform engineering\nEducation",
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0].description).toBe("- Led platform engineering");
  });
});
