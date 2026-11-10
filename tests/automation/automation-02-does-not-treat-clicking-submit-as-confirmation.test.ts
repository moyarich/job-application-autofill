import { describe, expect, it } from "vitest";

import { isSubmissionConfirmed } from "../../packages/job-sites/automation.ts";

describe("application safety", () => {
  it("does not treat clicking submit as confirmation", () => {
    expect(isSubmissionConfirmed("Submit your application")).toBe(false);
    expect(isSubmissionConfirmed("Thank you for your application!")).toBe(true);
    expect(isSubmissionConfirmed("Your application has been received")).toBe(
      true,
    );
  });
});
