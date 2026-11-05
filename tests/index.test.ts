import { describe, expect, it } from "vitest";
import {
  createApplication, emptyCandidate, parseCandidateJson, statuses, validateCandidate,
} from "../packages/job-application-autofill/src/index";

describe("candidate profile", () => {
  it("requires a first name, last name and valid email", () => {
    expect(validateCandidate(emptyCandidate)).toHaveLength(3);
    expect(validateCandidate({ ...emptyCandidate, contact: { ...emptyCandidate.contact, firstName: "A", lastName: "B", email: "a@example.com" } })).toEqual([]);
  });
  it("accepts the canonical nested resume object", () => {
    const profile = { ...emptyCandidate, contact:{...emptyCandidate.contact,firstName:"Ada"} };
    expect(parseCandidateJson(JSON.stringify(profile)).contact.firstName).toBe("Ada");
  });
  it("rejects non-string profile values", () => {
    expect(() => parseCandidateJson(JSON.stringify({...emptyCandidate,contact:{...emptyCandidate.contact,firstName:123}}))).toThrow();
  });
});
  
describe("application tracking", () => {
  it("creates a saved application", () => {
    expect(createApplication("Example", "Engineer", "https://example.com").status).toBe("saved");
  });
  it("rejects invalid URLs", () => {
    expect(() => createApplication("Example", "Engineer", "javascript:alert(1)")).toThrow();
  });
  it("has workflow statuses", () => {
    expect(statuses).toContain("ready_for_review");
    expect(statuses).toContain("submitted");
  });
});
