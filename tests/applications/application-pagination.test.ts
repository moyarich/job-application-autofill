import { expect, test } from "vitest";
import { paginateApplications } from "../../packages/job-application-autofill/src/utils/application/application-list";

test("pagination clamps invalid pages and displays accurate ranges for empty and filtered results", () => {
  const jobs = Array.from({ length: 23 }, (_, i) => i + 1);
  expect(paginateApplications(jobs, 1, 10)).toMatchObject({ page: 1, pageCount: 3, start: 1, end: 10, total: 23 });
  expect(paginateApplications(jobs, 3, 10)).toMatchObject({ page: 3, start: 21, end: 23, items: [21, 22, 23] });
  expect(paginateApplications(jobs, 99, 10).page).toBe(3);
  expect(paginateApplications(jobs, -4, 10).page).toBe(1);
  expect(paginateApplications([], 10, 10)).toEqual({ page: 1, pageCount: 1, start: 0, end: 0, total: 0, items: [] });
  expect(paginateApplications(jobs.slice(0, 4), 2, 10)).toMatchObject({ page: 1, start: 1, end: 4, total: 4 });
});
