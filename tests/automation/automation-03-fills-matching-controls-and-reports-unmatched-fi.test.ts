import { describe, expect, it, vi } from "vitest";
import type { Page } from "playwright";
import { emptyCandidate } from "../../packages/job-application-autofill/src/index.ts";
import { fillWorkdayContact } from "../../packages/job-sites/workday/contact.ts";

describe("application safety", () => {
  it("Workday-owned contact handler fills matching fields and reports missing fields", async () => {
    const target = {
      evaluate: vi.fn().mockResolvedValue("INPUT"),
      inputValue: vi.fn().mockResolvedValue(""),
      getAttribute: vi.fn().mockResolvedValue(null),
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true),
      fill: vi.fn().mockResolvedValue(undefined),
    };
    const missing = {
      isVisible: vi.fn().mockResolvedValue(false),
      isEnabled: vi.fn(),
      fill: vi.fn(),
    };
    const page = {
      getByLabel: vi.fn((pattern: RegExp) => ({
        first: () => (pattern.test("First Name") ? target : missing),
      })),
      getByPlaceholder: vi.fn(() => ({ first: () => missing })),
    };
    const profile = {
      ...structuredClone(emptyCandidate),
      contact: {
        ...emptyCandidate.contact,
        firstName: "Ada",
        email: "ada@example.com",
      },
    };
    const results = await fillWorkdayContact(page as unknown as Page, profile);
    expect(results.filled).toEqual(["firstName"]);
    expect(results.missing).toEqual(["email"]);
    expect(target.fill).toHaveBeenCalledWith("Ada", { timeout: 2000 });
  });
});
