export const MAX_RESUME = 10 * 1024 * 1024;

const RESUME_EXT_RE = /\.(pdf|docx)$/;
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
const UNSAFE_FILENAME_CHARS_RE = /[^a-z0-9._-]/gi;

export function decodeUpload(payload: unknown) {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("fileName" in payload) ||
    typeof payload.fileName !== "string" ||
    !("base64" in payload) ||
    typeof payload.base64 !== "string"
  )
    throw new Error("A resume filename and base64 content are required.");
  const ext = payload.fileName.toLowerCase().match(RESUME_EXT_RE)?.[1];
  if (!ext) throw new Error("Only PDF and DOCX resumes are supported.");
  if (payload.base64.length > Math.ceil((MAX_RESUME * 4) / 3) + 8)
    throw new Error("Resume exceeds 10 MB.");
  if (!BASE64_RE.test(payload.base64))
    throw new Error("Invalid base64 resume data.");
  const buffer = Buffer.from(payload.base64, "base64");
  if (!buffer.length || buffer.length > MAX_RESUME)
    throw new Error("Resume is empty or exceeds 10 MB.");
  if (ext === "pdf" && buffer.subarray(0, 5).toString() !== "%PDF-")
    throw new Error("Uploaded file is not a valid PDF.");
  if (ext === "docx" && buffer.readUInt32LE(0) !== 0x04034b50)
    throw new Error("Uploaded file is not a valid DOCX.");
  return {
    buffer,
    extension: ext as "pdf" | "docx",
    fileName: payload.fileName.replace(UNSAFE_FILENAME_CHARS_RE, "_"),
  };
}
