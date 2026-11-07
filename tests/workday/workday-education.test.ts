import { test, expect } from "vitest";
import { chromium } from "playwright";
import { fillWorkdayEducation } from "../../packages/job-sites/workday/education/education.ts";
test("fills saved education into a numbered Workday card", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(
      `<div><h3>Education</h3><div><h4>Education 1</h4><label>School or University*<input></label><label for="degree">Degree*</label><select id="degree"><option></option><option>Bachelor of Science</option></select><label>Field of Study<input></label></div><button>Add Another</button></div>`,
    );
    const entries = [
      {
        institution: "DeVry University",
        degree:
          "Bachelor of Science | Computer Information Systems | Chicago, IL",
        fieldOfStudy: "",
        location: "",
        startDate: "",
        endDate: "",
        description: "",
      },
    ];
    expect((await fillWorkdayEducation(page, entries)).unresolved).toEqual([]);
    expect(await page.getByLabel("School or University*").inputValue()).toBe(
      "DeVry University",
    );
    expect((await fillWorkdayEducation(page, entries)).unresolved).toEqual([]);
  } finally {
    await browser.close();
  }
});
