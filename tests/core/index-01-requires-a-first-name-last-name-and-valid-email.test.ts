import { describe, expect, it } from "vitest";
import { emptyCandidate, validateCandidate } from "../../packages/job-application-autofill/src/index";

describe("candidate profile", () => {
  it("requires a first name, last name and valid email", () => {
    expect(validateCandidate(emptyCandidate)).toHaveLength(3);
    expect(validateCandidate({ ...emptyCandidate, contact: { ...emptyCandidate.contact, firstName: "A", lastName: "B", email: "a@example.com" } })).toEqual([]);
  });
  
  
});
  
describe("application tracking", () => {
  
  
  
});

describe("application UUID v5", () => {
  
});
