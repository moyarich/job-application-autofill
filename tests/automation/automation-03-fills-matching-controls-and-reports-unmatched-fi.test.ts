import { describe, expect, it, vi } from "vitest";
import type { Page } from "playwright";
import { emptyCandidate } from "../../packages/job-application-autofill/src/index.ts";
import { fillKnownFields } from "../../packages/job-sites/automation.ts";

describe("application safety", () => {
  
  
  it("fills matching controls and reports unmatched fields", async () => {
    const target = { isVisible:vi.fn().mockResolvedValue(true), isEnabled:vi.fn().mockResolvedValue(true), fill:vi.fn().mockResolvedValue(undefined) };
    const missing = { isVisible:vi.fn().mockResolvedValue(false), isEnabled:vi.fn(), fill:vi.fn() };
    const page = {
      getByLabel: vi.fn((pattern: RegExp) => ({ first:() => pattern.test("First Name") ? target : missing })),
      getByPlaceholder: vi.fn(() => ({ first:() => missing })),
    };
    const profile = { ...structuredClone(emptyCandidate), contact: { ...emptyCandidate.contact, firstName:"Ada", email:"ada@example.com" } };
    const results = await fillKnownFields(page as unknown as Page, profile);
    expect(results.filled).toEqual(["firstName"]);
    expect(results.missing).toEqual(["email"]);
    expect(target.fill).toHaveBeenCalledWith("Ada", { timeout:2500 });
  });
});


