import { describe, expect, it } from "vitest";
import { validateResume } from "../../packages/resume/src/resume-schema/validate.ts";
import { extractProfile, decodeUpload } from "@moyarich/resume";

describe("resume parser", () => {
  it("extracts common profile data from text", () => {
    const result = extractProfile("Ada Lovelace\nada@example.com\nExperience with TypeScript, React, Node.js and AWS.");
    expect(result.contact.firstName).toBe("Ada");
    expect(result.contact.lastName).toBe("Lovelace");
    expect(result.contact.email).toBe("ada@example.com");
    expect(result.skills).toContain("TypeScript");
    expect(result.skills).toContain("React");
  });
  
});

describe("structured PDF reading order", () => {
  
});
