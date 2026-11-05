import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderResumePdf } from "../resume-schema/pdf.mjs";

const resume = JSON.parse(readFileSync(new URL("../resume-schema/resume.example.json", import.meta.url), "utf8"));
const pdfText = data => Buffer.from(data).toString("latin1");

describe("schema-driven PDF export", () => {
  it("creates a valid PDF from JSON without the PDF/DOCX extractor", () => {
    const bytes = renderResumePdf(resume);
    const text = pdfText(bytes);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/BaseFont /Helvetica");
    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("WORK EXPERIENCE");
    expect(text).toContain("EDUCATION");
    expect(text).toContain("PROFESSIONAL SUMMARY");
    expect(text).toContain("TypeScript, AWS");
    expect(text).toContain("%%EOF");
    expect(bytes.length).toBeGreaterThan(300);
  });
  it("generates multi-page PDF for lengthy histories without changing original job ordering", () => {
    const long = structuredClone(resume);
    long.experience = Array.from({length:35}, (_,i)=>({
      ...resume.experience[0],
      company:"Employer "+i,
      jobTitle:"Software Engineer "+i,
      startDate:String(2025-i).padStart(4, "0"),
      description:"Developed production APIs for distributed systems.\nLed design reviews.\nImproved application reliability.",
    }));
    const originalOrder = long.experience.map(job=>job.company);
    const text = pdfText(renderResumePdf(long));
    expect((text.match(/\/Type \/Page\b/g)||[]).length).toBeGreaterThan(1);
    expect(long.experience.map(job=>job.company)).toEqual(originalOrder);
  });
  it("rejects invalid objects rather than exporting misleading resume data", () => {
    expect(()=>renderResumePdf({firstName:"Ada"})).toThrow();
  });
  it("does not silently corrupt unsupported Unicode characters", () => {
    expect(()=>renderResumePdf({...resume,contact:{...resume.contact,firstName:"\u4e2d\u6587"}})).toThrow(/Unicode fonts/);
  });
});
