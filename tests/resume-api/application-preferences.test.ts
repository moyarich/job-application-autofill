import { expect, it } from "vitest";
import {
  openStore,
  DEFAULT_PROFILE_ID as owner,
} from "../../packages/resume-api/src/database/store.ts";

it("keeps preferences reusable, defaults unique, and application choices scoped to their owner", () => {
  const store = openStore(":memory:");
  try {
    const jobId = "e8796d4c-828e-4634-aa60-ab39bc95e241";
    store.updateJobRecord({
      revision: 0,
      job: {
        id: jobId,
        company: "Render",
        role: "Engineer",
        url: "https://example.com",
        status: "saved",
        createdAt: "2026-11-18",
        notes: "",
      },
    });
    const first = store.saveApplicationPreference(owner, null, {
      name: "US remote",
      isDefault: false,
      data: { country: "US", salary: "140000" },
    });
    const second = store.saveApplicationPreference(owner, null, {
      name: "Canada",
      isDefault: false,
      data: { country: "Canada", currency: "CAD" },
    });
    expect(first.isDefault).toBe(true);
    expect(store.getApplicationPreference(owner, jobId).preference?.id).toBe(
      first.id,
    );
    store.selectApplicationPreference(owner, jobId, second.id);
    expect(
      store.getApplicationPreference(owner, jobId).preference?.data.country,
    ).toBe("Canada");
    expect(
      store.listApplicationPreferences(owner).find((p) => p.id === first.id)
        ?.data.salary,
    ).toBe("140000");
    const updated = store.saveApplicationPreference(owner, second.id, {
      ...second,
      isDefault: true,
      data: { country: "Canada", currency: "CAD", availability: "Two weeks" },
    });
    expect(
      store.listApplicationPreferences(owner).filter((p) => p.isDefault),
    ).toHaveLength(1);
    expect(() =>
      store.saveApplicationPreference(owner, second.id, second),
    ).toThrow(/changed/);
    const other = store.createProfile("Other");
    expect(store.listApplicationPreferences(other.id)).toEqual([]);
    expect(() =>
      store.saveApplicationPreference(other.id, first.id, first),
    ).toThrow();
    expect(() =>
      store.selectApplicationPreference(other.id, jobId, first.id),
    ).toThrow();
    store.selectApplicationPreference(owner, jobId, null);
    expect(store.getApplicationPreference(owner, jobId)).toMatchObject({
      selectedId: null,
      preference: { id: second.id },
    });
    store.deleteApplicationPreference(owner, second.id, updated.revision);
    expect(store.getApplicationPreference(owner, jobId).preference?.id).toBe(
      first.id,
    );
    const remaining = store.listApplicationPreferences(owner)[0];
    store.deleteApplicationPreference(owner, first.id, remaining.revision);
    expect(store.getApplicationPreference(owner, jobId).preference).toBeNull();
  } finally {
    store.close();
  }
});

it("validates board data and applies only the corresponding board's default", () => {
  const store = openStore(":memory:");
  try {
    expect(
      store.listApplicationPreferenceSchemas().map(({ jobBoard }) => jobBoard),
    ).toEqual(["ashby", "greenhouse", "lever", "smart-recruiters", "workday"]);
    const general = store.saveApplicationPreference(owner, null, {
      name: "General",
      isDefault: true,
      data: { country: "USA" },
    });
    const ashby = store.saveApplicationPreference(owner, null, {
      name: "Ashby",
      jobBoard: "ashby",
      isDefault: false,
      data: { salaryMinimum: 140000.5, workArrangement: ["Remote"] },
    });
    const greenhouse = store.saveApplicationPreference(owner, null, {
      name: "Greenhouse",
      jobBoard: "greenhouse",
      isDefault: false,
      data: { startDate: "2027-01-01" },
    });
    expect(ashby).toMatchObject({
      jobBoard: "ashby",
      isDefault: true,
      data: { salaryMinimum: 140000.5, workArrangement: ["Remote"] },
    });
    expect(() =>
      store.saveApplicationPreference(owner, null, {
        name: "Invalid",
        jobBoard: "ashby",
        isDefault: false,
        data: { salaryMinimum: "140000" },
      }),
    ).toThrow(/Invalid preference data/);
    const workday = store.saveApplicationPreference(owner, null, {
      name: "Workday",
      jobBoard: "workday",
      isDefault: true,
      data: { noticePeriod: 2, noticeUnit: "Weeks" },
    });
    const jobId = "e8796d4c-828e-4634-aa60-ab39bc95e241";
    store.updateJobRecord({
      revision: 0,
      job: {
        id: jobId,
        company: "Render",
        role: "Engineer",
        url: "https://jobs.ashbyhq.com/example",
        status: "saved",
        createdAt: "2026-11-18",
        notes: "",
      },
    });
    expect(store.getApplicationPreference(owner, jobId)).toMatchObject({
      jobBoard: "ashby",
      preference: { id: ashby.id },
    });
    expect(() =>
      store.selectApplicationPreference(owner, jobId, greenhouse.id),
    ).toThrow(/not available/);
    expect(() =>
      store.selectApplicationPreference(owner, jobId, workday.id),
    ).toThrow(/not available/);
    const workdayJobId = "de418572-f31f-4049-842f-9d49f72319d4";
    store.updateJobRecord({
      revision: 0,
      job: {
        id: workdayJobId,
        company: "Example",
        role: "Engineer",
        url: "https://example.wd1.myworkdayjobs.com/en-US/careers/job/engineer",
        status: "saved",
        createdAt: "2026-11-18",
        notes: "",
      },
    });
    expect(store.getApplicationPreference(owner, workdayJobId)).toMatchObject({
      jobBoard: "workday",
      preference: {
        id: workday.id,
        data: { noticePeriod: 2, noticeUnit: "Weeks" },
      },
    });
    store.deleteApplicationPreference(owner, ashby.id, ashby.revision);
    expect(store.getApplicationPreference(owner, jobId).preference?.id).toBe(
      general.id,
    );
    expect(
      store
        .listApplicationPreferences(owner)
        .find(({ id }) => id === greenhouse.id)?.isDefault,
    ).toBe(true);
  } finally {
    store.close();
  }
});
