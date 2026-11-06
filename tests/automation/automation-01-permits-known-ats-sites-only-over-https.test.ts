import { describe, expect, it, vi } from "vitest";
import type { Browser, Page } from "playwright";
import { emptyCandidate } from "../../packages/job-application-autofill/src/index.ts";
import { validateUrl, isSubmissionConfirmed, fillKnownFields, prepareApplication, getActiveApplication, closeApplication } from "../../packages/job-sites/automation.ts";

describe("application safety", () => {
  it("permits known ATS sites only over HTTPS", () => {
    expect(validateUrl("https://jobs.lever.co/example/role")).toBe("https://jobs.lever.co/example/role");
    expect(() => validateUrl("https://jobs.lever.co.evil.example/job")).toThrow();
    expect(() => validateUrl("http://jobs.lever.co/example/job")).toThrow();
    expect(() => validateUrl("https://user:pass@jobs.lever.co/job")).toThrow();
  });
  
  
});


