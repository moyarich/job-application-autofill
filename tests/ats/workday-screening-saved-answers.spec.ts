import { test, expect } from "@playwright/test";
import { fillWorkdayScreeningAnswers } from "../../packages/job-boards/workday/screening/answers.ts";

test("Workday only fills exact safe saved answers and leaves consent untouched", async ({
  page,
}) => {
  await page.setContent(
    [
      '<section data-automation-id="questionnaireSection">',
      '<label for="work">Are you authorized to work in the United States?</label>',
      '<select id="work"><option>Select</option><option>Yes</option><option>No</option></select>',
      '<label for="details">What experience do you have with cloud development?</label>',
      '<textarea id="details"></textarea>',
      '<label for="consent">I have read and agree to the arbitration agreement</label>',
      '<select id="consent"><option>Select</option><option>Yes</option></select>',
      "</section>",
    ].join(""),
  );
  const result = await fillWorkdayScreeningAnswers(page, {
    "Are you authorized to work in the United States?": "Yes",
    "What experience do you have with cloud development?":
      "Built cloud applications.",
    "I have read and agree to the arbitration agreement": "Yes",
  });
  expect(result.filled).toEqual([
    "Are you authorized to work in the United States?",
    "What experience do you have with cloud development?",
  ]);
  expect(result.unresolved).toEqual([
    "I have read and agree to the arbitration agreement",
  ]);
  expect(await page.locator("#work").inputValue()).toBe("Yes");
  expect(await page.locator("#details").inputValue()).toBe(
    "Built cloud applications.",
  );
  expect(await page.locator("#consent").inputValue()).toBe("Select");
});
