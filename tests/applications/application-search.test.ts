import { expect, test } from "vitest";
import { searchApplications } from "../../packages/job-application-autofill/src/utils/application/application-list";
import type { JobApplication } from "../../packages/job-application-autofill/src/index";

const jobs: JobApplication[] = [
  {
    id: "b",
    company: "Acme",
    role: "Cloud Engineer",
    url: "https://example.com/first",
    notes: "AWS interview",
    status: "interview",
    createdAt: "2026-11-01",
  },
  {
    id: "a",
    company: "Beta",
    role: "Frontend Developer",
    url: "https://example.com/second",
    notes: "React screening",
    status: "saved",
    createdAt: "2026-11-03",
  },
  {
    id: "c",
    company: "Acme",
    role: "Backend Engineer",
    url: "",
    notes: "Remote",
    status: "submitted",
    createdAt: "2026-11-02",
  },
];

test("application search matches multiple terms across fields, status filters, and stable sorting", () => {
  expect(
    searchApplications(jobs, "  ACME   engineer ", "all", "newest").map(
      (x) => x.id,
    ),
  ).toEqual(["c", "b"]);
  expect(
    searchApplications(jobs, "aws cloud", "all", "newest").map((x) => x.id),
  ).toEqual(["b"]);
  expect(
    searchApplications(jobs, "react", "all", "newest").map((x) => x.id),
  ).toEqual(["a"]);
  expect(
    searchApplications(jobs, "inTERview", "interview", "newest").map(
      (x) => x.id,
    ),
  ).toEqual(["b"]);
  expect(
    searchApplications(jobs, "", "submitted", "newest").map((x) => x.id),
  ).toEqual(["c"]);
  expect(
    searchApplications(jobs, "", "all", "newest").map((x) => x.id),
  ).toEqual(["a", "c", "b"]);
  expect(
    searchApplications(jobs, "", "all", "oldest").map((x) => x.id),
  ).toEqual(["b", "c", "a"]);
  expect(
    searchApplications(jobs, "", "all", "company").map((x) => x.id),
  ).toEqual(["b", "c", "a"]);
  expect(jobs.map((x) => x.id)).toEqual(["b", "a", "c"]);
});
