import { describe, expect, it, vi } from "vitest";
import type { Browser } from "playwright";
import { readFileSync } from "node:fs";
import { renderResumeHtml, renderResumePdf } from "../../packages/resume/src/resume-schema/create-pdf.ts";

const resume = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json", import.meta.url), "utf8"));
function fakeBrowser() {
  const state = { html: "", pdfOptions: null as Record<string, unknown> | null, closed: false };
  const page = {
    setContent: vi.fn(async (html: string) => { state.html = html; }),
    evaluate: vi.fn(async () => undefined),
    pdf: vi.fn(async (options: Record<string, unknown>) => { state.pdfOptions = options; return Buffer.from("%PDF-1.4\n%%EOF"); })
  };
  const browser = { newPage: vi.fn(async () => page), close: vi.fn(async () => { state.closed = true; }) };
  return { state, browser, page };
}

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

describe("PDF pagination", () => {
  
});
