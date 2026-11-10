import { test } from "vitest";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { fillWorkdayExperience } from "../../packages/job-sites/workday/experience/experience.ts";

const jobs = [
  {
    company: "Example Technologies",
    jobTitle: "Senior Software Engineer",
    location: "Chicago, IL",
    startDate: "2021-06",
    endDate: null,
    isCurrent: true,
    description: "Built cloud apps.",
  },
  {
    company: "Example Solutions",
    jobTitle: "Software Engineer",
    location: "",
    startDate: "2018-03",
    endDate: "2021-05",
    isCurrent: false,
    description: "Maintained APIs.",
  },
];

test("Workday experience: skip when work section is missing", async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent("<main><h1>Login</h1></main>");
    const result = await fillWorkdayExperience(page, jobs);
    assert.equal(result.filled.length, 0);
    assert.equal(result.unresolved.length, 2);
  } finally {
    await browser.close();
  }
});
