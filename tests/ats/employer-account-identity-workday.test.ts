import { test, expect } from "vitest";
import { employerAccountIdentity } from "../../packages/job-boards/employer-account.ts";

test("Workday accounts are isolated by employer host and reused for jobs at that employer", () => {
  const first = employerAccountIdentity(
    "https://alpha.wd5.myworkdayjobs.com/Careers/job/123",
    "Alpha",
  );
  const second = employerAccountIdentity(
    "https://alpha.wd5.myworkdayjobs.com/Careers/job/456",
    "Alpha",
  );
  const other = employerAccountIdentity(
    "https://beta.wd5.myworkdayjobs.com/Careers/job/123",
    "Beta",
  );
  expect(first).toMatchObject({
    provider: "workday",
    employerKey: "alpha.wd5.myworkdayjobs.com",
  });
  expect(second?.employerKey).toBe(first?.employerKey);
  expect(other?.employerKey).not.toBe(first?.employerKey);
});
