import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateResume, parseResumeJson } from "../../packages/resume/src/resume-schema/validate.ts";
import { parseCandidateJson, validateCandidate } from "../../packages/job-application-autofill/src/index";

const example = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json", import.meta.url), "utf8"));

describe("extractor-independent resume JSON contract", () => {
  
  
  it("rejects malformed job fields and invalid date formats", () => {
    expect(() => validateResume({...example,experience:[{...example.experience[0],startDate:"June 2021"}]})).toThrow();
    expect(() => validateResume({...example,experience:[{...example.experience[0],isCurrent:"yes"}]})).toThrow();
  });
  
  
});
