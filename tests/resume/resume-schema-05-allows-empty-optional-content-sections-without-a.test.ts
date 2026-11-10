import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateResume } from "../../packages/resume/src/resume-schema/validate.ts";


const example = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json", import.meta.url), "utf8"));

describe("extractor-independent resume JSON contract", () => {
  
  
  
  
  it("allows empty optional-content sections without a resume file", () => {
    const empty = {...example,experience:[],education:[],projects:[],certifications:[],skills:[],languages:[],awards:[],source:{fileName:""}};
    expect(validateResume(empty)).toEqual(empty);
  });
});
