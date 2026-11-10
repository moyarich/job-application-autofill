import { describe, expect, it } from "vitest";
import { statuses } from "../../packages/job-application-autofill/src/index";

describe("application tracking", () => {
  it("has workflow statuses", () => {
    expect(statuses).toContain("ready_for_review");
    expect(statuses).toContain("submitted");
  });
});
