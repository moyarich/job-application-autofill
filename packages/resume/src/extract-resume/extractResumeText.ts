import { extractDocxText } from "./extractDocxText.ts";
import { extractPdfText } from "./extractPdfText.ts";

export async function extractResumeText(
  buffer: Buffer,
  extension: "pdf" | "docx",
) {
  return extension === "docx"
    ? extractDocxText(buffer)
    : extractPdfText(buffer);
}
