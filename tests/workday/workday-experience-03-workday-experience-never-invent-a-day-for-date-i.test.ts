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

test("Workday experience: never invent a day for date inputs", async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(
      "<section><h2>Work Experience</h2><div data-work-experience-entry>" +
        "<label>Company<input></label><label>Job Title<input></label>" +
        '<label>From Date<input type="date"></label><label>I currently work here<input type="checkbox"></label>' +
        "</div></section>",
    );
    const result = await fillWorkdayExperience(page, [jobs[0]]);
    assert.equal(result.filled.length, 0);
    assert.match(result.unresolved.join(" "), /startDate/);
    assert.equal(await page.getByLabel("From Date").inputValue(), "");
  } finally {
    await browser.close();
  }
});
