import { describe, expect, it } from "vitest";

import { decodeUpload } from "@moyarich/resume";

describe("resume parser", () => {
  
  it("rejects unsupported resume types", () => {
    expect(() => decodeUpload({ fileName:"test.txt",base64:"YWJj" })).toThrow();
  });
});

describe("structured PDF reading order", () => {
  
});
