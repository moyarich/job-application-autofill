// PDF attachment decoder for application requests.
// Intentionally separate from the optional PDF/DOCX extraction package.
const MAX_PDF_BYTES = 10 * 1024 * 1024;
export function decodePdfAttachment(payload: {
  fileName: string;
  base64: string;
}) {
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.fileName !== "string" ||
    typeof payload.base64 !== "string" ||
    !/\.pdf$/i.test(payload.fileName)
  )
    throw new Error("A PDF resume filename and base64 content are required.");
  const encoded = payload.base64;
  if (
    encoded.length > Math.ceil((MAX_PDF_BYTES * 4) / 3) + 8 ||
    !/^[a-zA-Z0-9+/]*={0,2}$/.test(encoded)
  )
    throw new Error("Invalid or oversized PDF attachment.");
  const buffer = Buffer.from(encoded, "base64");
  if (
    !buffer.length ||
    buffer.length > MAX_PDF_BYTES ||
    buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
  )
    throw new Error("A valid PDF resume (10 MB or less) is required.");
  const fileName = payload.fileName
    .split(/[\\/]/)
    .pop()!
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  return { buffer, extension: "pdf", fileName };
}
