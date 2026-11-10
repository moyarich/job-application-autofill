import { test, expect } from "@playwright/test";
import { fillWorkdayScreeningAnswers } from "../../packages/job-boards/workday/screening/answers.ts";

test("Workday custom prompt dropdowns use only exact saved answers", async ({ page }) => {
  await page.setContent([
    '<div role="group" aria-label="Would you consider relocating?">',
    '<button type="button" id="choice">Select One Required</button>',
    '<div role="listbox" id="options" hidden>',
    '<div role="option">I am local to where the job is based</div>',
    '<div role="option">Yes</div>',
    '</div></div>',
    '<script>',
    'document.querySelector("#choice").addEventListener("click", () => {',
    'document.querySelector("#options").hidden = false;',
    '});',
    'document.querySelectorAll("[role=option]").forEach(item => {',
    'item.addEventListener("click", () => {',
    'document.querySelector("#choice").textContent = item.textContent;',
    'document.querySelector("#options").hidden = true;',
    '});});',
    '</script>',
  ].join(""));
  const answer = "I am local to where the job is based";
  const result = await fillWorkdayScreeningAnswers(page, {
    "Would you consider relocating?": answer,
  });
  expect(result).toEqual({ filled: ["Would you consider relocating?"], unresolved: [] });
  expect(await page.locator("#choice").innerText()).toBe(answer);
});
