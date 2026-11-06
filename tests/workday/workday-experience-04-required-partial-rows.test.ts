import { test, expect } from "vitest";
import { chromium } from "playwright";
import { fillWorkdayExperience } from "../../packages/job-sites/workday/experience.ts";

test("fills company and location in an existing imported job with required labels", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<div data-automation-id="workExperienceSection"><div data-automation-id="workExperience-1">
      <label>Job Title*<input value="Web Developer"></label><label>Company*<input></label>
      <label>Location<input></label><label>From*<input placeholder="MM/YYYY" value="09/2012"></label>
      <label>To*<input placeholder="MM/YYYY" value="04/2013"></label>
      <label>I currently work here<input type="checkbox"></label></div><button>Add Another</button></div>`);
    const job = {
      company: "Example City",
      jobTitle: "Web Developer",
      location: "Evanston",
      startDate: "2012-09",
      endDate: "2013-04",
      isCurrent: false,
    };
    expect(await fillWorkdayExperience(page, [job])).toEqual({
      filled: ["experience[0]"],
      unresolved: [],
    });
    expect(await page.getByLabel("Company*").inputValue()).toBe(job.company);
    expect(await page.getByLabel("Location").inputValue()).toBe(job.location);
    expect(
      await page.locator('[data-automation-id="workExperience-1"]').count(),
    ).toBe(1);
    expect(await fillWorkdayExperience(page, [job])).toEqual({
      filled: ["experience[0]"],
      unresolved: [],
    });
  } finally {
    await browser.close();
  }
});

test("supports Workday numbered cards without custom section attributes", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(
      `<main><div><h3>Work Experience</h3><div id="rows"></div><button onclick="document.querySelector('#rows').innerHTML='<div><h4>Work Experience 1</h4><label>Company*<input></label><label>Job Title*<input></label><label>Location<input></label><label>From*<input></label><label>I currently work here<input type=checkbox></label></div>'">Add</button></div><div><h3>Education</h3><button>Add</button></div></main>`,
    );
    const result = await fillWorkdayExperience(page, [
      {
        company: "Example",
        jobTitle: "Developer",
        location: "Chicago",
        startDate: "2020-01",
        isCurrent: true,
      },
    ]);
    expect(result.unresolved).toEqual([]);
    expect(await page.getByLabel("Company*").inputValue()).toBe("Example");
  } finally {
    await browser.close();
  }
});
