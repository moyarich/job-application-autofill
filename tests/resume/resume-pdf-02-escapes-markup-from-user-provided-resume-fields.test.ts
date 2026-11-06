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

describe("PDF pagination", () => {
  
});
