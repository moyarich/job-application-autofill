import { test, expect } from "@playwright/test";
import { fillWorkdayScreeningAnswers } from "../../packages/job-boards/workday/screening/answers.ts";

test("answers from another role are not filled unless explicitly supplied", async ({ page }) => {
  await page.setContent([
    '<section data-automation-id="questionnaireSection">',
    '<label for="motivation">Why do you want this position?</label>',
    '<textarea id="motivation"></textarea>',
    '</section>',
  ].join(""));
  const oldJobAnswers = { "Why do you want to work at Acme?": "I love Acme products." };
  const result = await fillWorkdayScreeningAnswers(page, oldJobAnswers);
  expect(result.filled).toEqual([]);
  expect(result.unresolved).toEqual(["Why do you want to work at Acme?"]);
  expect(await page.locator("#motivation").inputValue()).toBe("");
});

test("saved answers never accept an employer arbitration agreement", async ({ page }) => {
  await page.setContent([
    '<section data-automation-id="questionnaireSection">',
    '<label for="agreement">I have read and agree to the arbitration agreement</label>',
    '<select id="agreement"><option>Select</option><option>Yes</option></select>',
    '</section>',
  ].join(""));
  const result = await fillWorkdayScreeningAnswers(page, {
    "I have read and agree to the arbitration agreement": "Yes",
  });
  expect(result.filled).toEqual([]);
  expect(await page.locator("#agreement").inputValue()).toBe("Select");
});
