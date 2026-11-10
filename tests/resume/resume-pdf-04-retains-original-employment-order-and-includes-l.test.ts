import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { renderResumeHtml } from "../../packages/resume/src/create-resume/create-pdf.ts";

const resume = JSON.parse(
  readFileSync(
    new URL(
      "../../packages/resume/src/resume-schema/resume.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

describe("Unicode resume PDF export", () => {
  it("retains original employment order and includes long histories", () => {
    const long = structuredClone(resume);
    long.experience = Array.from({ length: 35 }, (_, i) => ({
      ...resume.experience[0],
      company: "Employer " + i,
      jobTitle: "Software Engineer " + i,
      startDate: String(2025 - i).padStart(4, "0"),
    }));
    const order = long.experience.map((e: { company: string }) => e.company);
    const html = renderResumeHtml(long);
    expect(html).toContain("Employer 34");
    expect(html).toContain("Employer 0");
    expect(long.experience.map((e: { company: string }) => e.company)).toEqual(
      order,
    );
  });
});
