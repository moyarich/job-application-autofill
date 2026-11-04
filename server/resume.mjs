import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { inflateRawSync } from "node:zlib";
const execFileAsync = promisify(execFile);
const MAX_RESUME = 10 * 1024 * 1024;
const skillWords = ["JavaScript", "TypeScript", "React", "Next.js", "Vue", "Node.js", "Python", "FastAPI", "AWS", "Docker", "Kubernetes", "PostgreSQL", "DynamoDB", "Redis", "GraphQL", "Java", "C#", "Go", "SQL", "Playwright", "Git", "Azure", "GCP", "LangChain", "Machine Learning", "Generative AI"];
export function decodeUpload(payload) {
  if (!payload || typeof payload !== "object" || typeof payload.fileName !== "string" || typeof payload.base64 !== "string")
    throw new Error("A resume filename and base64 content are required.");
  const ext = payload.fileName.toLowerCase().match(/\.(pdf|docx)$/)?.[1];
  if (!ext) throw new Error("Only PDF and DOCX resumes are supported.");
  if (payload.base64.length > Math.ceil(MAX_RESUME * 4 / 3) + 8) throw new Error("Resume exceeds 10 MB.");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(payload.base64)) throw new Error("Invalid base64 resume data.");
  const buffer = Buffer.from(payload.base64, "base64");
  if (!buffer.length || buffer.length > MAX_RESUME) throw new Error("Resume is empty or exceeds 10 MB.");
  if (ext === "pdf" && buffer.subarray(0, 5).toString() !== "%PDF-")
    throw new Error("Uploaded file is not a valid PDF.");
  if (ext === "docx" && buffer.readUInt32LE(0) !== 0x04034b50)
    throw new Error("Uploaded file is not a valid DOCX.");
  return { buffer, extension: ext, fileName: payload.fileName.replace(/[^a-z0-9._-]/gi, "_") };
}
export function extractDocxText(buffer) {
  // Read ZIP central directory; standard DOCX files are ZIP archives.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Invalid DOCX archive.");
  const size = buffer.readUInt32LE(eocd + 12), offset = buffer.readUInt32LE(eocd + 16);
  let pos = offset;
  const end = Math.min(offset + size, buffer.length);
  while (pos + 46 <= end && buffer.readUInt32LE(pos) === 0x02014b50) {
    const method = buffer.readUInt16LE(pos + 10);
    const compressed = buffer.readUInt32LE(pos + 20);
    const uncompressed = buffer.readUInt32LE(pos + 24);
    const fileNameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    const localOffset = buffer.readUInt32LE(pos + 42);
    const name = buffer.subarray(pos + 46, pos + 46 + fileNameLen).toString("utf8");
    pos += 46 + fileNameLen + extraLen + commentLen;
    if (name !== "word/document.xml") continue;
    if (uncompressed > 15 * 1024 * 1024) throw new Error("DOCX document is too large.");
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Invalid DOCX contents.");
    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    if (start + compressed > buffer.length) throw new Error("Invalid DOCX compression length.");
    const data = buffer.subarray(start, start + compressed);
    const xml = (method === 8 ? inflateRawSync(data, { maxOutputLength: 15 * 1024 * 1024 }) : method === 0 ? data : (()=>{throw new Error("Unsupported DOCX compression");})()).toString("utf8");
    return xml.replace(/<\/w:p>/g, "\n").replace(/<w:tab\b[^>]*\/?\s*>/g, "\t")
      .replace(/<w:br\b[^>]*\/?\s*>/g, "\n").replace(/<[^>]+>/g, "")
      .replace(/&(?:amp|lt|gt|quot|apos|#(\d+)|#x([0-9a-f]+));/gi, (match, dec, hex) => {
        if (dec) return String.fromCodePoint(Number(dec));
        if (hex) return String.fromCodePoint(parseInt(hex, 16));
        return ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" })[match] || match;
      });
  }
  throw new Error("DOCX is missing word/document.xml.");
}
export async function extractResumeText(buffer, extension) {
  if (extension === "docx") return extractDocxText(buffer);
  // Python PDFium extracts selectable text and invokes RapidOCR only for scanned pages.
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join, resolve } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "moya-resume-"));
  try {
    const input = join(dir, "resume.pdf");
    await writeFile(input, buffer, { mode: 0o600 });
    const python = process.env.PYTHON_EXECUTABLE || "python3";
    const script = resolve(import.meta.dirname, "pdf_ocr.py");
    const { stdout } = await execFileAsync(python, [script, input], {
      timeout: 120000,
      maxBuffer: 15 * 1024 * 1024,
      windowsHide: true,
    });
    let result;
    try {
      result = JSON.parse(stdout);
    } catch (error) {
      throw new Error("PDF extraction produced an invalid response.", { cause: error });
    }
    if (typeof result.text !== "string" || !result.text.trim())
      throw new Error("PDF extraction found no readable text.");
    return result.text;
  } catch (error) {
    if (error.code === "ENOENT")
      throw new Error("Python is required for PDF extraction. Set PYTHON_EXECUTABLE to your virtual environment's Python executable.", { cause: error });
    if (error.killed || error.code === "ETIMEDOUT")
      throw new Error("PDF extraction exceeded the 120-second timeout.", { cause: error });
    if (error.stderr)
      throw new Error(`PDF extraction failed: ${error.stderr.toString().trim().slice(0, 700)}`, { cause: error });
    throw error;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
export function extractProfile(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = text.match(/(?:\+?\d[\d\s.()-]{8,}\d)/)?.[0]?.trim() || "";
  const linkedIn = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i)?.[0] || "";
  const github = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/i)?.[0] || "";
  const website = text.match(/https?:\/\/(?!www\.(?:linkedin|github)\.com)[^\s)]+/i)?.[0] || "";
  const heading = lines.find(line => line.length <= 65 && /^[\p{L}][\p{L} .'-]+$/u.test(line) && line.split(/\s+/).length >= 2 && line.split(/\s+/).length <= 4 && !/resume|experience|skills|education|summary|curriculum/i.test(line)) || "";
  const parts = heading.split(/\s+/).filter(Boolean);
  const skills = skillWords.filter(word => new RegExp("(^|[^a-z0-9])" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^a-z0-9])", "i").test(text));
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" "),
    email, phone, location: "", linkedIn, github, website,
    skills: skills.join(", "), summary: "", resumeFileName: "" };
}
export { MAX_RESUME };
