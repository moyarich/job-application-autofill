import { describe, expect, it } from "vitest";
import { createApplication } from "../../packages/job-application-autofill/src/index";
  
describe("application tracking", () => {
  
  it("rejects invalid URLs", () => {
    expect(() => createApplication("Example", "Engineer", "javascript:alert(1)")).toThrow();
  });
  
});
