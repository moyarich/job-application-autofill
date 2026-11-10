import { describe, expect, it } from "vitest";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/src/database/store.ts";

const job = (id: string, company: string, role: string) => ({
  id, company, role, url: "https://example.com/" + company, status: "saved",
  createdAt: "2026-11-09T00:00:00Z", notes: "",
});

describe("Shared screening answer records", () => {
  it("uses one source for current answers and attributed previous examples, isolated by profile", () => {
    const store = openStore(":memory:");
    const previous = "cd449340-630d-4dc1-8184-95d6674f5c42";
    const current = "4d5272db-af96-4b62-9fc4-9de436ab5a40";
    const foreign = "c8f21b60-183e-44fb-b8f4-97ef2ac70001";
    try {
      store.updateJobRecord({ revision: 0, job: job(previous, "Acme", "API Developer") });
      store.updateJobRecord({ revision: 0, job: job(current, "Beta", "Platform Engineer") });
      store.saveApplicationAnswers(DEFAULT_PROFILE_ID, previous, {
        "Describe a challenging API integration": "Integrated cloud services for Acme.",
      });
      store.saveApplicationAnswers(DEFAULT_PROFILE_ID, current, {
        "How do you handle outages?": "I monitor recovery closely.",
      });
      const otherProfile = store.createProfile("Another person");
      store.updateJobRecord({ revision: 0, job: job(foreign, "Private", "Security Engineer") }, otherProfile.id);
      store.saveApplicationAnswers(otherProfile.id, foreign, {
        "Describe a challenging API integration": "Different person's answer.",
      });
      const context = store.getApplicationAnswerContext(DEFAULT_PROFILE_ID, current);
      expect(context.answers).toEqual({
        "How do you handle outages?": "I monitor recovery closely.",
      });
      expect(context.examples).toEqual([
        expect.objectContaining({
          applicationId: previous, company: "Acme", role: "API Developer",
          question: "Describe a challenging API integration",
          answer: "Integrated cloud services for Acme.",
        }),
      ]);
      expect(context.examples).not.toContainEqual(
        expect.objectContaining({ applicationId: current }),
      );
      store.deleteJobRecord(previous, { revision: 1 });
      expect(store.getApplicationAnswerContext(DEFAULT_PROFILE_ID, current).examples).toEqual([]);
      expect(() => store.getApplicationAnswerContext(otherProfile.id, current)).toThrow();
    } finally {
      store.close();
    }
  });
});
