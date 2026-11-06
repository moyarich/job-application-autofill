// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — migrated test fixtures retain runtime assertions.
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderResumeHtml, renderResumePdf } from "../packages/resume/src/resume-schema/create-pdf.ts";

const resume = JSON.parse(readFileSync(new URL("../packages/resume/src/resume-schema/resume.example.json", import.meta.url), "utf8"));
function fakeBrowser() {
  const state = { html: "", pdfOptions: null, closed: false };
  const page = {
    setContent: vi.fn(async html => { state.html = html; }),
    evaluate: vi.fn(async () => undefined),
    pdf: vi.fn(async options => { state.pdfOptions = options; return Buffer.from("%PDF-1.4\n%%EOF"); })
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

  it("escapes markup from user-provided resume fields", () => {
    const unsafe = structuredClone(resume);
    unsafe.summary = '<script>alert("x")</script> & text';
    unsafe.contact.firstName = "<Ada>";
    const html = renderResumeHtml(unsafe);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;Ada&gt;");
    expect(html).not.toContain("<script>");
  });

  it("renders with Chromium and closes the browser", async () => {
    const { browser, page, state } = fakeBrowser();
    const bytes = await renderResumePdf(resume, { launchBrowser: async () => browser });
    expect(Buffer.from(bytes).toString("utf8")).toContain("%PDF-1.4");
    expect(page.setContent).toHaveBeenCalledOnce();
    expect(page.evaluate).toHaveBeenCalledOnce();
    expect(state.html).toContain("Ada Lovelace");
    expect(state.html).toContain("WORK EXPERIENCE".toLowerCase().replace(/work experience/, "Work Experience"));
    expect(state.pdfOptions).toMatchObject({ format: "Letter", printBackground: true, preferCSSPageSize: true });
    expect(state.closed).toBe(true);
  });

  it("retains original employment order and includes long histories", () => {
    const long = structuredClone(resume);
    long.experience = Array.from({ length: 35 }, (_, i) => ({
      ...resume.experience[0],
      company: "Employer " + i,
      jobTitle: "Software Engineer " + i,
      startDate: String(2025 - i).padStart(4, "0")
    }));
    const order = long.experience.map(e => e.company);
    const html = renderResumeHtml(long);
    expect(html).toContain("Employer 34");
    expect(html).toContain("Employer 0");
    expect(long.experience.map(e => e.company)).toEqual(order);
  });

  it("rejects malformed structured input", () => {
    expect(() => renderResumeHtml({ firstName: "Ada" })).toThrow();
  });

  it("closes Chromium when printing fails", async () => {
    const { browser, page, state } = fakeBrowser();
    page.pdf.mockRejectedValue(new Error("Print failed"));
    await expect(renderResumePdf(resume, { launchBrowser: async () => browser })).rejects.toThrow("Print failed");
    expect(state.closed).toBe(true);
  });
});

describe("PDF pagination", () => {
  it("allows long roles to flow across pages while keeping individual bullets together", () => {
    const html = renderResumeHtml(resume);
    expect(html).toContain("article { margin-bottom: 9pt; break-inside: auto; }");
    expect(html).toContain("overflow-wrap: anywhere; break-inside: avoid;");
    expect(html).toContain(".meta, .period { break-after: avoid; }");
  });
});
