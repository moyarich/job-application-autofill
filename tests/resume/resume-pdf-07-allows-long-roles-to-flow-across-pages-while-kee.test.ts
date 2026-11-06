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
  

  

  

  

  

  
});

describe("PDF pagination", () => {
  it("allows long roles to flow across pages while keeping individual bullets together", () => {
    const html = renderResumeHtml(resume);
    expect(html).toContain("article { margin-bottom: 9pt; break-inside: auto; }");
    expect(html).toContain("overflow-wrap: anywhere; break-inside: avoid;");
    expect(html).toContain(".meta, .period { break-after: avoid; }");
  });
});
