import { test, expect } from "vitest";
import { employerAccountIdentity } from "../../packages/job-boards/employer-account.ts";

test("a shared ATS keeps each company's account separate", () => {
  const cases = [
    [
      "https://boards.greenhouse.io/companyone/jobs/100",
      "https://boards.greenhouse.io/companytwo/jobs/100",
    ],
    [
      "https://jobs.lever.co/companyone/100",
      "https://jobs.lever.co/companytwo/100",
    ],
    [
      "https://jobs.ashbyhq.com/companyone/100",
      "https://jobs.ashbyhq.com/companytwo/100",
    ],
    [
      "https://jobs.smartrecruiters.com/companyone/100",
      "https://jobs.smartrecruiters.com/companytwo/100",
    ],
  ];
  for (const [firstUrl, secondUrl] of cases) {
    const one = employerAccountIdentity(firstUrl, "Company One");
    const two = employerAccountIdentity(secondUrl, "Company Two");
    expect(one?.employerKey).toBeDefined();
    expect(two?.employerKey).not.toBe(one?.employerKey);
    expect(one?.provider).toBe(two?.provider);
  }
});
