import { test, expect } from "@playwright/test";
import { captureEmployerAnswers } from "../../packages/job-sites/answer-capture.ts";

test("captures custom written Speechify answers from the actual employer form only", async ({ page }) => {
  await page.setContent(`
    <form>
      <label for="why">Why do you want to work at Speechify?</label>
      <textarea id="why"></textarea>
      <label for="hardest">What is one of the hardest technical problems you have worked on?</label>
      <textarea id="hardest"></textarea>
      <label for="email">Email</label><input id="email" type="email" />
      <label for="password">Password</label><input id="password" type="password" />
    </form>
  `);
  await page.getByLabel("Why do you want to work at Speechify?").fill("I want to make reading more accessible.");
  await page.getByLabel("What is one of the hardest technical problems you have worked on?")
    .fill("Designing a reliable distributed service.");
  await page.getByLabel("Email").fill("candidate@example.com");
  await page.getByLabel("Password").fill("do-not-store");
  expect(await captureEmployerAnswers(page)).toEqual({
    "Why do you want to work at Speechify?": "I want to make reading more accessible.",
    "What is one of the hardest technical problems you have worked on?": "Designing a reliable distributed service.",
  });
});
