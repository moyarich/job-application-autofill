import { describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { readFileSync } from "node:fs";
import { renderResumePdf } from "../../packages/resume/src/resume-schema/create-pdf.ts";
import { decodePdfAttachment } from "../../packages/resume/src/resume-schema/attachment.ts";
import { validateResume } from "../../packages/resume/src/resume-schema/validate.ts";

const example = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json",import.meta.url),"utf8"));

describe("application needs structured resume JSON and a PDF attachment",()=>{
  
  it("rejects docx and forged attachments",()=>{
    expect(()=>decodePdfAttachment({fileName:"resume.docx",base64:Buffer.from("%PDF-1.4").toString("base64")})).toThrow();
    expect(()=>decodePdfAttachment({fileName:"resume.pdf",base64:Buffer.from("not pdf").toString("base64")})).toThrow();
    expect(()=>decodePdfAttachment({fileName:"resume.pdf",base64:"invalid?"})).toThrow();
  });
});
