import { test, expect } from "vitest";
import {
  openStore,
  DEFAULT_PROFILE_ID,
} from "../../packages/resume-api/src/database/store.ts";

const job = (id: string, company: string) => ({
  id,
  company,
  role: "Software Engineer",
  url: "https://example.com/" + company,
  status: "saved",
  createdAt: "2026-11-09T00:00:00Z",
  notes: "",
});
test("answer library supports CRUD without overwriting duplicates, stale edits or another profile", () => {
  const store = openStore(":memory:");
  const first = "cd449340-630d-4dc1-8184-95d6674f5c42";
  const second = "4d5272db-af96-4b62-9fc4-9de436ab5a40";
  try {
    store.updateJobRecord({ revision: 0, job: job(first, "Acme") });
    store.updateJobRecord({ revision: 0, job: job(second, "Beta") });
    const original = store.createApplicationAnswer(
      DEFAULT_PROFILE_ID,
      first,
      "Describe cloud development",
      "Used AWS.",
    );
    expect(
      store.getApplicationAnswerContext(DEFAULT_PROFILE_ID, second).examples,
    ).toEqual([
      expect.objectContaining({ answer: "Used AWS.", company: "Acme" }),
    ]);
    expect(() =>
      store.createApplicationAnswer(
        DEFAULT_PROFILE_ID,
        first,
        original.question,
        "Overwrite",
      ),
    ).toThrow(/already exists/i);
    const updated = store.updateApplicationAnswer(
      DEFAULT_PROFILE_ID,
      first,
      original.question,
      original.answer,
      original.updatedAt,
      "Built on AWS.",
    );
    expect(updated.answer).toBe("Built on AWS.");
    expect(
      store.getApplicationAnswerContext(DEFAULT_PROFILE_ID, first)
        .currentRecords,
    ).toEqual([expect.objectContaining({ answer: "Built on AWS." })]);
    expect(() =>
      store.updateApplicationAnswer(
        DEFAULT_PROFILE_ID,
        first,
        original.question,
        original.answer,
        original.updatedAt,
        "Stale overwrite",
      ),
    ).toThrow(/changed|deleted/i);
    const another = store.createProfile("Another person");
    expect(() =>
      store.deleteApplicationAnswer(
        another.id,
        first,
        original.question,
        updated.answer,
        updated.updatedAt,
      ),
    ).toThrow(/not found/i);
    expect(() =>
      store.createApplicationAnswer(
        DEFAULT_PROFILE_ID,
        first,
        "I agree to arbitration",
        "Yes",
      ),
    ).toThrow(/restricted/i);
    expect(
      store.deleteApplicationAnswer(
        DEFAULT_PROFILE_ID,
        first,
        original.question,
        updated.answer,
        updated.updatedAt,
      ),
    ).toEqual({ deleted: true });
    expect(
      store.getApplicationAnswerContext(DEFAULT_PROFILE_ID, second).examples,
    ).toEqual([]);
  } finally {
    store.close();
  }
});
