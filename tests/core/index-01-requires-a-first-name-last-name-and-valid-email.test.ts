import { describe, expect, it } from "vitest";
import {
  emptyCandidate,
  validateResume,
} from "../../packages/job-application-autofill/src/index";

describe("candidate profile", () => {
  it("requires a first name, last name and valid email", () => {
    expect(validateResume(emptyCandidate)).toHaveLength(3);
    expect(
      validateResume({
        ...emptyCandidate,
        contact: {
          ...emptyCandidate.contact,
          firstName: "A",
          lastName: "B",
          email: "a@example.com",
        },
      }),
    ).toEqual([]);
  });
});
