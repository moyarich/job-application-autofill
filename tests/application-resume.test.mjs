import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderResumePdf } from "../resume-schema/pdf.mjs";
import { decodePdfAttachment } from "../resume-schema/attachment.mjs";
import { validateResume } from "../resume-schema/validate.mjs";

const example = JSON.parse(readFileSync(new URL("../resume-schema/resume.example.json",import.meta.url),"utf8"));

describe("application needs structured resume JSON and a PDF attachment",()=>{
  it("accepts JSON-only profile data, renders PDF, and decodes the resulting attachment without an extractor",()=>{
    const resume=validateResume({...example,source:{fileName:""}});
    const bytes=renderResumePdf(resume);
    const decoded=decodePdfAttachment({fileName:"Ada-Lovelace.pdf",base64:Buffer.from(bytes).toString("base64")});
    expect(decoded.extension).toBe("pdf");
    expect(decoded.fileName).toBe("Ada-Lovelace.pdf");
    expect(decoded.buffer.subarray(0,5).toString()).toBe("%PDF-");
    expect(decoded.buffer).toEqual(Buffer.from(bytes));
  });
  it("rejects docx and forged attachments",()=>{
    expect(()=>decodePdfAttachment({fileName:"resume.docx",base64:Buffer.from("%PDF-1.4").toString("base64")})).toThrow();
    expect(()=>decodePdfAttachment({fileName:"resume.pdf",base64:Buffer.from("not pdf").toString("base64")})).toThrow();
    expect(()=>decodePdfAttachment({fileName:"resume.pdf",base64:"invalid?"})).toThrow();
  });
});
