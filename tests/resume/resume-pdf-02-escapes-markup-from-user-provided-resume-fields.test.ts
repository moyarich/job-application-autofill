import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { renderResumeHtml } from "../../packages/resume/src/resume-schema/create-pdf.ts";

const resume = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json", import.meta.url), "utf8"));

describe("Unicode resume PDF export", () => {
  

  it("escapes markup from user-provided resume fields", () => {
    const unsafe = structuredClone(resume);
    unsafe.summary = '<script>alert("x")</script> & text';
    unsafe.contact.firstName = "<Ada>";
    const html = renderResumeHtml(unsafe);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;Ada&gt;");
    expect(html).not.toContain("<script>");
  });

  

  

  

  
});
