import { describe, expect, it } from "vitest";


import { renderResumeHtml } from "../../packages/resume/src/resume-schema/create-pdf.ts";


describe("Unicode resume PDF export", () => {
  

  

  

  

  it("rejects malformed structured input", () => {
    expect(() => renderResumeHtml({ firstName: "Ada" })).toThrow();
  });

  
});

describe("PDF pagination", () => {
  
});
