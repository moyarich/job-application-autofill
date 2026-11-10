import { describe, expect, it } from "vitest";

import { validateUrl } from "../../packages/job-boards/automation.ts";

describe("application safety", () => {
  it("permits known ATS sites only over HTTPS", () => {
    expect(validateUrl("https://jobs.lever.co/example/role")).toBe(
      "https://jobs.lever.co/example/role",
    );
    expect(() =>
      validateUrl("https://jobs.lever.co.evil.example/job"),
    ).toThrow();
    expect(() => validateUrl("http://jobs.lever.co/example/job")).toThrow();
    expect(() => validateUrl("https://user:pass@jobs.lever.co/job")).toThrow();
  });
});
