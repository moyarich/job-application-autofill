import { describe, expect, it } from "vitest";
import { filterAnswerLibrary, relatedAnswers, type PreviousAnswer } from "../../packages/job-application-autofill/src/components/ScreeningAnswerDock/suggestions.ts";

const data: PreviousAnswer[] = [
  {
    applicationId: "one", question: "Describe cloud development experience",
    answer: "Created cloud APIs.", company: "Acme", role: "API Engineer",
    updatedAt: "2026-10-10T00:00:00Z",
  },
  {
    applicationId: "two", question: "Describe your cloud development experience",
    answer: "Built cloud services.", company: "Beta", role: "Platform Engineer",
    updatedAt: "2026-11-09T00:00:00Z",
  },
  {
    applicationId: "three", question: "I agree to arbitration",
    answer: "Yes", company: "Beta", role: "Platform Engineer",
    updatedAt: "2026-11-09T00:00:00Z",
  },
];

describe("Answer library search and restricted suggestion safety", () => {
  it("searches text and filters by company, role and sort", () => {
    expect(filterAnswerLibrary(data, {
      search: "cloud", company: "Beta", role: "Platform Engineer", sort: "recent",
    }).map((item) => item.applicationId)).toEqual(["two"]);
    expect(filterAnswerLibrary(data, {
      search: "", company: "", role: "", sort: "company",
    }).map((item) => item.applicationId)).toEqual(["one", "two"]);
    expect(filterAnswerLibrary(data, {
      search: "arbitration", company: "", role: "", sort: "recent",
    })).toEqual([]);
  });
  it("does not treat unrelated single-word overlap as a reusable question", () => {
    expect(relatedAnswers("Describe your cloud development experience", data)
      .map((item) => item.applicationId)).toContain("two");
    expect(relatedAnswers("Do you know Java?", data)).toEqual([]);
    expect(relatedAnswers("I agree to arbitration", data)).toEqual([]);
  });
});
