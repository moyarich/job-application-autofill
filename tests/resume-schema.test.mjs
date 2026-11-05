import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateResume, parseResumeJson } from "../resume-schema/validate.mjs";
import { parseCandidateJson, validateCandidate } from "../packages/job-application-autofill/src/index";

const example = JSON.parse(readFileSync(new URL("../resume-schema/resume.example.json", import.meta.url), "utf8"));

describe("extractor-independent resume JSON contract", () => {
  it("accepts a complete, externally generated resume without PDF/DOCX files", () => {
    const independent = structuredClone(example);
    independent.source.fileName = "";
    const parsed = parseResumeJson(JSON.stringify(independent));
    expect(parsed.contact.email).toBe("ada@example.com");
    expect(parseCandidateJson(JSON.stringify(independent))).toEqual(independent);
    expect(validateCandidate(independent)).toEqual([]);
    expect(validateResume(independent)).toEqual(independent);
  });
  it("rejects an old flat profile and unknown fields (no migration)", () => {
    expect(() => parseResumeJson('{"firstName":"Ada","email":"ada@example.com"}')).toThrow();
    expect(() => validateResume({...example, unexpected:"field"})).toThrow();
  });
  it("rejects malformed job fields and invalid date formats", () => {
    expect(() => validateResume({...example,experience:[{...example.experience[0],startDate:"June 2021"}]})).toThrow();
    expect(() => validateResume({...example,experience:[{...example.experience[0],isCurrent:"yes"}]})).toThrow();
  });
  it("allows empty optional-content sections without a resume file", () => {
    const empty = {...example,experience:[],education:[],projects:[],certifications:[],skills:[],languages:[],awards:[],source:{fileName:""}};
    expect(validateResume(empty)).toEqual(empty);
  });
});
