import { describe, expect, it } from "vitest";
import {
  createApplication, emptyCandidate, parseCandidateJson, statuses, validateCandidate,
} from "../../packages/job-application-autofill/src/index";

describe("candidate profile", () => {
  
  
  
});
  
describe("application tracking", () => {
  
  it("rejects invalid URLs", () => {
    expect(() => createApplication("Example", "Engineer", "javascript:alert(1)")).toThrow();
  });
  
});

describe("application UUID v5", () => {
  
});
