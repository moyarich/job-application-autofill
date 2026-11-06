import { describe, expect, it } from "vitest";


import { decodePdfAttachment } from "../../packages/resume/src/resume-schema/attachment.ts";


describe("application needs structured resume JSON and a PDF attachment",()=>{
  
  it("rejects docx and forged attachments",()=>{
    expect(()=>decodePdfAttachment({fileName:"resume.docx",base64:Buffer.from("%PDF-1.4").toString("base64")})).toThrow();
    expect(()=>decodePdfAttachment({fileName:"resume.pdf",base64:Buffer.from("not pdf").toString("base64")})).toThrow();
    expect(()=>decodePdfAttachment({fileName:"resume.pdf",base64:"invalid?"})).toThrow();
  });
});
