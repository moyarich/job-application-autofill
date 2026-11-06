import { describe, expect, it } from "vitest";
import {
  createApplication, emptyCandidate, parseCandidateJson, statuses, validateCandidate,
} from "../../packages/job-application-autofill/src/index";

describe("candidate profile", () => {
  
  
  
});
  
describe("application tracking", () => {
  it("creates a saved application", () => {
    expect(createApplication("Example", "Engineer", "https://example.com").status).toBe("saved");
  });
  
  
});

describe("application UUID v5", () => {
  
});
