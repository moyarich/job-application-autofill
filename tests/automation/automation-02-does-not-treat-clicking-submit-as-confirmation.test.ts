import { describe, expect, it, vi } from "vitest";
import type { Browser, Page } from "playwright";
import { emptyCandidate } from "../../packages/job-application-autofill/src/index.ts";
import { validateUrl, isSubmissionConfirmed, fillKnownFields, prepareApplication, getActiveApplication, closeApplication } from "../../packages/job-sites/automation.ts";

describe("application safety", () => {
  
  it("does not treat clicking submit as confirmation", () => {
    expect(isSubmissionConfirmed("Submit your application")).toBe(false);
    expect(isSubmissionConfirmed("Thank you for your application!")).toBe(true);
    expect(isSubmissionConfirmed("Your application has been received")).toBe(true);
  });
  
});


