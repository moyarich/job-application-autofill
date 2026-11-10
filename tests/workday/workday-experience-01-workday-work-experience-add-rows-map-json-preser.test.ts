import { test } from "vitest";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { fillWorkdayExperience } from "../../packages/job-boards/workday/experience/experience.ts";

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
const row = (index: number) =>
  '<div data-work-experience-entry><label>Company<input type="text" name="company' +
  index +
  '"></label>' +
  '<label>Job Title<input type="text" name="title' +
  index +
  '"></label>' +
  '<label>Location<input type="text"></label>' +
  '<label>From Date<input type="text" placeholder="MM/YYYY"></label>' +
  '<label>To Date<input type="text" placeholder="MM/YYYY"></label>' +
  '<label>I currently work here<input type="checkbox"></label>' +
  "<label>Role Description<textarea></textarea></label></div>";

test("Workday work experience: add rows, map JSON, preserve previous rows and avoid duplicate additions", async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(
      "<!doctype html><html><body>" +
        '<section><h2>Education</h2><button>Add</button><label>Company<input value="Never touch me"></label></section>' +
        '<section id="work"><h2>Work Experience</h2><div id="entries">' +
        row(0) +
        "</div>" +
        '<button id="add" type="button">Add Another</button></section>' +
        '<script>document.querySelector("#add").addEventListener("click",()=>{' +
        'const entries=document.querySelector("#entries");const block=entries.firstElementChild.cloneNode(true);' +
        'for(const field of block.querySelectorAll("input,textarea")){if(field.type==="checkbox")field.checked=false;else field.value="";}' +
        "entries.appendChild(block);});</script></body></html>",
    );
    const one = await fillWorkdayExperience(page, jobs);
    assert.deepEqual(one, {
      filled: ["experience[0]", "experience[1]"],
      unresolved: [],
    });
    const entries = page.locator("[data-work-experience-entry]");
    assert.equal(await entries.count(), 2);
    assert.equal(
      await entries.nth(0).getByLabel("Company").inputValue(),
      "Example Technologies",
    );
    assert.equal(
      await entries.nth(1).getByLabel("Company").inputValue(),
      "Example Solutions",
    );
    assert.equal(
      await entries.nth(0).getByLabel("From Date").inputValue(),
      "06/2021",
    );
    assert.equal(
      await entries.nth(1).getByLabel("To Date").inputValue(),
      "05/2021",
    );
    assert.equal(
      await entries.nth(0).getByLabel("I currently work here").isChecked(),
      true,
    );
    assert.equal(
      await entries.nth(1).getByLabel("I currently work here").isChecked(),
      false,
    );
    assert.equal(
      await entries.nth(0).getByLabel("Role Description").inputValue(),
      "Built cloud apps.",
    );
    assert.equal(
      await page.locator("section").first().getByLabel("Company").inputValue(),
      "Never touch me",
    );
    const again = await fillWorkdayExperience(page, jobs);
    assert.deepEqual(again, {
      filled: ["experience[0]", "experience[1]"],
      unresolved: [],
    });
    assert.equal(await entries.count(), 2);
  } finally {
    await browser.close();
  }
});
