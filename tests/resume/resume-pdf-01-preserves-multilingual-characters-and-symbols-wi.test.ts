import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { renderResumeHtml } from "../../packages/resume/src/resume-schema/create-pdf.ts";

const resume = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json", import.meta.url), "utf8"));

describe("Unicode resume PDF export", () => {
  it("preserves multilingual characters and symbols without replacing them with ASCII", () => {
    const multilingual = structuredClone(resume);
    multilingual.contact.firstName = "李";
    multilingual.contact.lastName = "小龍";
    multilingual.summary = "● 中文 日本語 한국어 العربية हिन्दी Ελληνικά Кириллица ✓ 👩‍💻";
    multilingual.experience[0].description = "• Built distributed systems\n✓ Déployé sur AWS";
    const html = renderResumeHtml(multilingual);
    expect(html).toContain("李 小龍");
    expect(html).toContain(multilingual.summary);
    expect(html).toContain("<li>Built distributed systems</li>");
    expect(html).toContain("✓ Déployé sur AWS");
    expect(html).toContain('charset="UTF-8"');
    expect(html).not.toContain("built-in Latin font");
  });

  

  

  

  

  
});
