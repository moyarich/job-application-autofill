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
  

  

  it("renders with Chromium and closes the browser", async () => {
    const { browser, page, state } = fakeBrowser();
    const bytes = await renderResumePdf(resume, { launchBrowser: async () => browser as unknown as Browser });
    expect(Buffer.from(bytes).toString("utf8")).toContain("%PDF-1.4");
    expect(page.setContent).toHaveBeenCalledOnce();
    expect(page.evaluate).toHaveBeenCalledOnce();
    expect(state.html).toContain("Ada Lovelace");
    expect(state.html).toContain("WORK EXPERIENCE".toLowerCase().replace(/work experience/, "Work Experience"));
    expect(state.pdfOptions).toMatchObject({ format: "Letter", printBackground: true, preferCSSPageSize: true });
    expect(state.closed).toBe(true);
  });

  

  

  
});

describe("PDF pagination", () => {
  
});
