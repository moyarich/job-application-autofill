import { test, expect } from "vitest";
import { chromium } from "playwright";
import { ADAPTERS } from "../../packages/job-boards/index.ts";
import { emptyCandidate } from "../../packages/job-application-autofill/src/index.ts";

test("education and skills status reads existing employer values without autofill history", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<label>School or University<input value="Example University"></label>
      <label>Degree<select><option value="bachelors">Bachelor's Degree</option></select></label>
      <section data-automation-id="skillsSection"><input placeholder="Type to Add Skills"><span data-skill-token>Python</span></section>`);
    const context = {
      page,
      profile: emptyCandidate,
      directory: "/tmp",
      pendingResume: null,
    };
    const education = ADAPTERS.workday.steps!.find(
      (step) => step.id === "workday.education",
    )!;
    const skills = ADAPTERS.workday.steps!.find(
      (step) => step.id === "workday.skills",
    )!;
    expect(await education.inspectStatus!(context)).toBe("filled");
    expect(await skills.inspectStatus!(context)).toBe("filled");
    await page.getByLabel("School or University").fill("");
    expect(await education.inspectStatus!(context)).toBe("needs_review");
    await page.locator("[data-skill-token]").evaluate((node) => node.remove());
    expect(await skills.inspectStatus!(context)).toBe("ready");
  } finally {
    await browser.close();
  }
});
