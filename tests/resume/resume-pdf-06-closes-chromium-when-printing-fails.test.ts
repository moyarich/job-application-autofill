import { describe, expect, it, vi } from "vitest";
import type { Browser } from "playwright";
import { readFileSync } from "node:fs";
import { renderResumePdf } from "../../packages/resume/src/resume-schema/create-pdf.ts";

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
  

  

  

  

  

  it("closes Chromium when printing fails", async () => {
    const { browser, page, state } = fakeBrowser();
    page.pdf.mockRejectedValue(new Error("Print failed"));
    await expect(renderResumePdf(resume, { launchBrowser: async () => browser as unknown as Browser })).rejects.toThrow("Print failed");
    expect(state.closed).toBe(true);
  });
});
