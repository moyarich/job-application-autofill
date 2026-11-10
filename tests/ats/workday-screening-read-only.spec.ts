import { test, expect } from "@playwright/test";
import { workdaySteps } from "../../packages/job-sites/workday/steps.ts";
import workday from "../../packages/job-sites/workday/index.ts";
import type { JobSiteAdapter, JobSiteStepContext } from "../../packages/job-sites/types.ts";

test("Workday discovers questions but does not answer or change the employer form", async ({ page }) => {
  const screening = workdaySteps.find((entry) => entry.id === "workday.screening");
  if (!screening) throw new Error("Missing screening step");
  await page.setContent('<nav>Screening Questions</nav>');
  const context = { page } as unknown as JobSiteStepContext;
  expect(await screening.matches(context)).toBe(false);
  await page.setContent(`
    <section data-automation-id="questionnaireSection">
      <label for="why">Why do you want to work here?</label>
      <textarea id="why">My own written answer</textarea>
    </section>
  `);
  expect(await screening.matches(context)).toBe(true);
  const result = await screening.run(context);
  expect(result.questions?.map((question) => question.label))
    .toContain("Why do you want to work here?");
  expect(await page.locator("#why").inputValue()).toBe("My own written answer");
  expect((workday as JobSiteAdapter).answerQuestions).toBeUndefined();
});
