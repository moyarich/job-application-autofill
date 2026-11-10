import { expect, it } from "vitest";
import { extractProfile } from "../../packages/resume/src/extract-resume/index.ts";
import { renderResumeHtml } from "../../packages/resume/src/create-resume/create-pdf.ts";
import { validateResume } from "../../packages/resume/src/resume-schema/validate.ts";

it("preserves wrapped bullets, skill categories, team context and additional sections", () => {
  const profile = extractProfile(`Ada Lovelace
Professional Summary
Software engineer.
Technical Skills:
Languages: Python,
JavaScript
Professional Experience:
Independent Software Consultant Aug. 2011 – Present
Senior Full-Stack Developer
● Build reliable
applications.
● Mentor engineers.
Acme Web Services
Customer Engineering Oct 2022 – July 2025
Solution Developer
● Built APIs.
Education:
Example University
Community Leadership and Technical Writing
● Lead a community of 94,000 members.
Technical Writing:
https://example.com/articles
Creative technology and design
● Create digital assets.
Design Portfolio:
https://example.com/design`);
  expect(validateResume(profile)).toEqual(profile);
  expect(profile.experience[0].description).toBe(
    "- Build reliable applications.\n- Mentor engineers.",
  );
  expect(profile.experience[1].location).toBe("Customer Engineering");
  expect(profile.skillGroups).toEqual([
    { heading: "Languages", content: "Python, JavaScript" },
  ]);
  const html = renderResumeHtml(profile);
  expect(html.indexOf("Independent Software Consultant")).toBeLessThan(
    html.indexOf("Acme Web Services"),
  );
  expect(html).toContain("<li>Build reliable applications.</li>");
  expect(html).not.toContain("<li>applications.</li>");
  expect(html).toContain("94,000");
  expect(html).toContain("https://example.com/articles");
  expect(html).toContain("https://example.com/design");
});
