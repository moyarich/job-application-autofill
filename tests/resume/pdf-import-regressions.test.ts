import { expect, test } from "vitest";
import { extractProfile } from "@moyarich/resume";

test("keeps punctuated employers separate and preserves surrounding descriptions", () => {
  const profile = extractProfile(`Ada Lovelace
WORK EXPERIENCE
Senior Software Developer
Example Association
May 2021 – Oct 2022
Built application integrations.
Senior Full-Stack Developer
Example Dental Supply LLC.
Apr 2013 – Feb 2021
Built customer\u0002facing applications.
Web Developer
City of Example
Sep 2012 – Apr 2013
Maintained web servers.
EDUCATION
Example University
Bachelor of Science | Computer Information Systems | Chicago, IL
CERTIFICATIONS
AWS Certified Solutions Architect – Associate
Amazon Web Services`);
  expect(profile.experience.map((job) => job.company)).toEqual([
    "Example Association",
    "Example Dental Supply LLC.",
    "City of Example",
  ]);
  expect(profile.experience[0].description).toBe(
    "Built application integrations.",
  );
  expect(profile.experience[1]).toMatchObject({
    jobTitle: "Senior Full-Stack Developer",
    startDate: "2013-04",
    endDate: "2021-02",
    description: "Built customer-facing applications.",
  });
  expect(profile.education[0]).toMatchObject({
    institution: "Example University",
    degree: "Bachelor of Science",
    fieldOfStudy: "Computer Information Systems",
    location: "Chicago, IL",
  });
  expect(profile.certifications).toHaveLength(1);
  expect(profile.certifications[0].issuer).toBe("Amazon Web Services");
});

test("joins PDF line wrapping into complete responsibilities for Slate", async () => {
  const { markdownToEditor } =
    await import("@moyarich/resume/markdown");
  const parsed = extractProfile(`Ada Lovelace
WORK EXPERIENCE
Example Inc.
Software Engineer
2021 - Present
Designed applications using Python, React, JavaScript,
TypeScript, MySQL, HTML, and CSS.
Partnered with business teams to modernize internal
workflows and improve productivity.
EDUCATION`);
  const description = parsed.experience[0].description;
  expect(description).toBe(
    "Designed applications using Python, React, JavaScript, TypeScript, MySQL, HTML, and CSS.\nPartnered with business teams to modernize internal workflows and improve productivity.",
  );
  const nodes = markdownToEditor(description);
  expect(nodes).toHaveLength(2);
  expect(nodes.every((node) => node.type === "paragraph")).toBe(true);
  expect(nodes[0].children[0].text).toContain("TypeScript, MySQL");
});
