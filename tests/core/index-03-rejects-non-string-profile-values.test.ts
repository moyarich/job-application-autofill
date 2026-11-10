import { describe, expect, it } from "vitest";
import {
  emptyCandidate,
  parseCandidateJson,
} from "../../packages/job-application-autofill/src/index";

describe("candidate profile", () => {
  it("rejects non-string profile values", () => {
    expect(() =>
      parseCandidateJson(
        JSON.stringify({
          ...emptyCandidate,
          contact: { ...emptyCandidate.contact, firstName: 123 },
        }),
      ),
    ).toThrow();
  });
});
