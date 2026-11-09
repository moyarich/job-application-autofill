import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const component = (name: string) => readFileSync(
  new URL("../../packages/job-application-autofill/src/components/" + name + "/" + name + ".tsx", import.meta.url),
  "utf8",
);

test("empty states are concise and omit duplicate zero-result pagination", () => {
  const applications = component("Opportunities");
  const resumes = component("ResumeManager");
  const contacts = component("ContactManager");
  const noResume = component("NoResume");

  expect(applications).toContain('"No applications yet."');
  expect(applications).toContain('"No matching applications."');
  expect(applications).toContain("{filtered.length > 0 && <Pagination");
  expect(resumes).toContain('"No resumes yet"');
  expect(resumes).toContain('"No resumes found"');
  expect(contacts).toContain("No contacts yet.");
  expect(noResume).toContain("Go to resumes");
});
