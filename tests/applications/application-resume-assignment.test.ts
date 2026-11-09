import { expect, it } from "vitest";
import { openStore, DEFAULT_PROFILE_ID } from "../../packages/resume-api/src/database/store.ts";

it("persists a different selected resume for each application", () => {
  const store = openStore(":memory:");
  try {
    const cloud = store.createResume(DEFAULT_PROFILE_ID, "Cloud resume");
    const frontend = store.createResume(DEFAULT_PROFILE_ID, "Frontend resume");
    const common = { company: "Example", role: "Engineer", status: "saved",
      createdAt: "2026-11-09T00:00:00Z", notes: "" };
    const first = {
      ...common, id: "8bfc6e76-e5c9-4c29-8a51-d750ba43b924",
      url: "https://example.com/cloud", resumeId: cloud.id,
    };
    const second = {
      ...common, id: "29c0df1b-2083-457d-b3df-45a8c7619f30",
      url: "https://example.com/frontend", resumeId: frontend.id,
    };
    store.updateJobRecord({ revision: 0, job: first });
    store.updateJobRecord({ revision: 0, job: second });
    expect(store.getJobList().jobs).toEqual(expect.arrayContaining([first, second]));
    store.updateJobRecord({ revision: 1, job: { ...first, notes: "Interview" } });
    expect(store.getJobList().jobs.find((job) => job.id === second.id)?.resumeId).toBe(frontend.id);
  } finally {
    store.close();
  }
});
