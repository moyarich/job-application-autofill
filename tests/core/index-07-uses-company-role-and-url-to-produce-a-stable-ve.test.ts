import { describe, expect, it } from "vitest";
import { createApplication } from "../../packages/job-application-autofill/src/index";

describe("application UUID v5", () => {
  it("uses company, role and URL to produce a stable version 5 UUID", () => {
    const first = createApplication("Example", "Engineer", "https://example.com/job");
    expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(createApplication(" Example ", "Engineer", "https://example.com/job").id).toBe(first.id);
    expect(createApplication("Other", "Engineer", "https://example.com/job").id).not.toBe(first.id);
    expect(createApplication("Example", "Manager", "https://example.com/job").id).not.toBe(first.id);
    expect(createApplication("Example", "Engineer", "https://example.com/other").id).not.toBe(first.id);
  });
});
