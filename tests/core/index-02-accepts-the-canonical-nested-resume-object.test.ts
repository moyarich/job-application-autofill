import { describe, expect, it } from "vitest";
import { emptyCandidate, parseCandidateJson } from "../../packages/job-application-autofill/src/index";

describe("candidate profile", () => {
  
  it("accepts the canonical nested resume object", () => {
    const profile = { ...emptyCandidate, contact:{...emptyCandidate.contact,firstName:"Ada"} };
    expect(parseCandidateJson(JSON.stringify(profile)).contact.firstName).toBe("Ada");
  });
  
});
  
describe("application tracking", () => {
  
  
  
});

describe("application UUID v5", () => {
  
});
