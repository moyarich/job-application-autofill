import { describe, expect, it } from "vitest";
import { extractProfile, decodeUpload } from "../server/resume.mjs";

describe("resume parser", () => {
  it("extracts common profile data from text", () => {
    const result = extractProfile("Ada Lovelace\nada@example.com\nExperience with TypeScript, React, Node.js and AWS.");
    expect(result.firstName).toBe("Ada");
    expect(result.lastName).toBe("Lovelace");
    expect(result.email).toBe("ada@example.com");
    expect(result.skills).toContain("TypeScript");
    expect(result.skills).toContain("React");
  });
  it("rejects unsupported resume types", () => {
    expect(() => decodeUpload({ fileName:"test.txt",base64:"YWJj" })).toThrow();
  });
});
