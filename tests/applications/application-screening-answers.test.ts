import { describe, expect, it } from "vitest";
import {
  openStore,
  DEFAULT_PROFILE_ID,
} from "../../packages/resume-api/src/database/store.ts";

const job = (id: string) => ({
  id,
  company: "Speechify",
  role: "Software Engineer",
  url: "https://example.com/speechify",
  status: "saved",
  createdAt: "2026-11-09T00:00:00Z",
  notes: "",
});

describe("Application-specific screening answers", () => {
  it("persists custom written answers only on their application and deletes them with it", () => {
    const store = openStore(":memory:");
    const first = "cd449340-630d-4dc1-8184-95d6674f5c42";
    const second = "4d5272db-af96-4b62-9fc4-9de436ab5a40";
    try {
      store.updateJobRecord({ revision: 0, job: job(first) });
      store.updateJobRecord({ revision: 0, job: job(second) });
      const saved = store.saveApplicationAnswers(DEFAULT_PROFILE_ID, first, {
        "Why do you want to work at Speechify?":
          "I care about accessible audio tools.",
        "What is one of the hardest technical problems you have worked on?":
          "Scaling a distributed system.",
        Password: "never-store",
      });
      expect(saved).toEqual({
        "What is one of the hardest technical problems you have worked on?":
          "Scaling a distributed system.",
        "Why do you want to work at Speechify?":
          "I care about accessible audio tools.",
      });
      expect(store.listApplicationAnswers(DEFAULT_PROFILE_ID, second)).toEqual(
        {},
      );
      store.deleteJobRecord(first, { revision: 1 });
      expect(store.getJobList().jobs).toHaveLength(1);
      expect(() =>
        store.listApplicationAnswers(DEFAULT_PROFILE_ID, first),
      ).toThrow();
    } finally {
      store.close();
    }
  });
});
