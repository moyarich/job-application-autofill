import { describe, expect, it } from "vitest";
import { extractEmploymentHistory } from "@moyarich/resume";
describe("employment history", () => {
  it("does not guess undated jobs", () =>
    expect(
      extractEmploymentHistory("Skills\nAWS\nEducation\nUniversity"),
    ).toEqual([]));
});
