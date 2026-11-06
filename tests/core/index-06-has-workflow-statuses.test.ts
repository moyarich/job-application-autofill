import { describe, expect, it } from "vitest";
import {
  createApplication, emptyCandidate, parseCandidateJson, statuses, validateCandidate,
} from "../../packages/job-application-autofill/src/index";

describe("candidate profile", () => {
  
  
  
});
  
describe("application tracking", () => {
  
  
  it("has workflow statuses", () => {
    expect(statuses).toContain("ready_for_review");
    expect(statuses).toContain("submitted");
  });
});

describe("application UUID v5", () => {
  
});
