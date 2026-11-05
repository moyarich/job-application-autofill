import { describe, expect, it, vi } from "vitest";
import { validateUrl, isSubmissionConfirmed, fillKnownFields } from "../server/automation.mjs";

describe("application safety", () => {
  it("permits known ATS sites only over HTTPS", () => {
    expect(validateUrl("https://jobs.lever.co/example/role")).toBe("https://jobs.lever.co/example/role");
    expect(() => validateUrl("https://jobs.lever.co.evil.example/job")).toThrow();
    expect(() => validateUrl("http://jobs.lever.co/example/job")).toThrow();
    expect(() => validateUrl("https://user:pass@jobs.lever.co/job")).toThrow();
  });
  it("does not treat clicking submit as confirmation", () => {
    expect(isSubmissionConfirmed("Submit your application")).toBe(false);
    expect(isSubmissionConfirmed("Thank you for your application!")).toBe(true);
    expect(isSubmissionConfirmed("Your application has been received")).toBe(true);
  });
  it("fills matching controls and reports unmatched fields", async () => {
    const target = { isVisible:vi.fn().mockResolvedValue(true), isEnabled:vi.fn().mockResolvedValue(true), fill:vi.fn().mockResolvedValue(undefined) };
    const missing = { isVisible:vi.fn().mockResolvedValue(false), isEnabled:vi.fn(), fill:vi.fn() };
    const page = {
      getByLabel: vi.fn((pattern) => ({ first:() => pattern.test("First Name") ? target : missing })),
      getByPlaceholder: vi.fn(() => ({ first:() => missing })),
    };
    const results = await fillKnownFields(page, { contact: { firstName:"Ada", email:"ada@example.com" } });
    expect(results.filled).toEqual(["firstName"]);
    expect(results.missing).toEqual(["email"]);
    expect(target.fill).toHaveBeenCalledWith("Ada", { timeout:2500 });
  });
});
