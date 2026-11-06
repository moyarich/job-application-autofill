import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateResume } from "../../packages/resume/src/resume-schema/validate.ts";


const example = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json", import.meta.url), "utf8"));

describe("extractor-independent resume JSON contract", () => {
  
  
  
  it("validates all employment entries without a 40-role cutoff or description truncation", () => {
    const expanded = structuredClone(example);
    expanded.experience = Array.from({length: 45}, (_, i) => ({
      ...example.experience[0],
      company: "Company " + i,
      description: "Experience-" + i + ": " + "AWS and TypeScript ".repeat(300)
    }));
    const validated = validateResume(expanded);
    expect(validated.experience).toHaveLength(45);
    expect(validated.experience.at(-1)?.description).toBe(expanded.experience.at(-1)?.description);
  });
  
});
