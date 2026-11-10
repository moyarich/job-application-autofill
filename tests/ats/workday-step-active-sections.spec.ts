import { test, expect } from "@playwright/test";
import { workdaySteps } from "../../packages/job-boards/workday/steps.ts";
import type { JobSiteStepContext } from "../../packages/job-boards/types.ts";

test("Workday runs steps only when their editable sections are present", async ({
  page,
}) => {
  const context = {
    page,
    profile: {
      experience: [{ company: "Acme", jobTitle: "Engineer" }],
      education: [{ institution: "University", degree: "BS" }],
      skills: ["TypeScript"],
    },
  } as unknown as JobSiteStepContext;
  const find = (id: string) => {
    const step = workdaySteps.find((entry) => entry.id === id);
    if (!step) throw new Error("Missing step " + id);
    return step;
  };
  await page.setContent(`
    <nav>Work Experience Education Skills</nav>
    <h2>Work Experience</h2><h2>Education</h2><h2>Skills</h2>
  `);
  for (const id of [
    "workday.work-experience",
    "workday.education",
    "workday.skills",
  ])
    expect(await find(id).matches(context)).toBe(false);

  await page.setContent(`
    <section data-automation-id="workExperienceSection">
      <label>Company<input /></label>
    </section>
    <div><h2>Education</h2>
      <button type="button">Add</button>
      <label>School<input /></label>
    </div>
    <section data-automation-id="skillsSection">
      <label>Skills<input /></label>
    </section>
  `);
  for (const id of [
    "workday.work-experience",
    "workday.education",
    "workday.skills",
  ])
    expect(await find(id).matches(context)).toBe(true);
});
