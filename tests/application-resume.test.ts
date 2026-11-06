// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — migrated test fixtures retain runtime assertions.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderResumePdf } from "../packages/resume/src/resume-schema/create-pdf.ts";
import { decodePdfAttachment } from "../packages/resume/src/resume-schema/attachment.ts";
import { validateResume } from "../packages/resume/src/resume-schema/validate.ts";

const example = JSON.parse(readFileSync(new URL("../packages/resume/src/resume-schema/resume.example.json",import.meta.url),"utf8"));

describe("application needs structured resume JSON and a PDF attachment",()=>{
  it("accepts JSON-only profile data and decodes generated Unicode PDF attachments",async()=>{
    const resume=validateResume({...example,source:{fileName:""}});
    const bytes=await renderResumePdf(resume, { launchBrowser: async()=>({
      newPage: async()=>({
        setContent: async()=>{}, evaluate: async()=>{},
        pdf: async()=>Buffer.from("%PDF-1.4\nUnicode PDF bytes\n%%EOF")
      }),
      close: async()=>{}
    }) });
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
