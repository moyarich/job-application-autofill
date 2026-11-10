import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as resumeSchema from "../../packages/resume/src/resume-schema/validate.ts";
import {
  parseCandidateJson,
  validateResume,
} from "../../packages/job-application-autofill/src/index";

const example = JSON.parse(
  readFileSync(
    new URL(
      "../../packages/resume/src/resume-schema/resume.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

describe("extractor-independent resume JSON contract", () => {
  it("accepts a complete, externally generated resume without PDF/DOCX files", () => {
    const independent = structuredClone(example);
    independent.source.fileName = "";
    const parsed = resumeSchema.parseResumeJson(JSON.stringify(independent));
    expect(parsed.contact.email).toBe("ada@example.com");
    expect(parseCandidateJson(JSON.stringify(independent))).toEqual(
      independent,
    );
    expect(validateResume(independent)).toEqual([]);
    expect(resumeSchema.validateResume(independent)).toEqual(independent);
  });
});
