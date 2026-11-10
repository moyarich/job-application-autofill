import { test, expect } from "vitest";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/src/database/store.ts";

test("application CRUD preserves identity and deletes linked screening answers", () => {
  const store = openStore(":memory:");
  const id = "90ea97f7-7f75-48b5-a3d5-0f4f1508cb06";
  const job = {
    id, company: "First Employer", role: "Backend Engineer",
    url: "https://example.com/job/1", status: "saved",
    createdAt: "2026-11-09T00:00:00Z", notes: "",
  };
  try {
    const created = store.updateJobRecord({ revision: 0, job }, DEFAULT_PROFILE_ID);
    expect(created.revision).toBe(1);
    expect(store.getJobList(DEFAULT_PROFILE_ID).jobs).toEqual([
      expect.objectContaining(job),
    ]);
    store.saveApplicationAnswers(DEFAULT_PROFILE_ID, id, {
      "Describe cloud integration experience": "Built integrations on AWS.",
    });
    const changed = { ...job, company: "Second Employer", role: "Platform Engineer",
      url: "https://example.com/job/2" };
    expect(store.updateJobRecord({ revision: 1, job: changed }, DEFAULT_PROFILE_ID))
      .toEqual({ revision: 2 });
    expect(store.getJobList(DEFAULT_PROFILE_ID).jobs[0]).toMatchObject(changed);
    expect(store.listApplicationAnswers(DEFAULT_PROFILE_ID, id))
      .toEqual({ "Describe cloud integration experience": "Built integrations on AWS." });
    expect(() => store.updateJobRecord({ revision: 1, job }, DEFAULT_PROFILE_ID))
      .toThrow(/changed|reload|stale/i);
    expect(store.deleteJobRecord(id, { revision: 2 }, DEFAULT_PROFILE_ID))
      .toEqual({ deleted: true });
    expect(store.getJobList(DEFAULT_PROFILE_ID).jobs).toEqual([]);
    expect(() => store.listApplicationAnswers(DEFAULT_PROFILE_ID, id))
      .toThrow(/not found/i);
  } finally { store.close(); }
});
