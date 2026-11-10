import { describe, expect, it } from "vitest";
import { createApplication } from "../../packages/job-application-autofill/src/index";

describe("application tracking", () => {
  it("creates a saved application", () => {
    expect(
      createApplication("Example", "Engineer", "https://example.com").status,
    ).toBe("saved");
  });
});
