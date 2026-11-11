import { inflateRawSync } from "node:zlib";

const XML_PARAGRAPH_END_RE = /<\/w:p>/g;
const XML_TAB_RE = /<w:tab\b[^>]*\/?\s*>/g;
const XML_BREAK_RE = /<w:br\b[^>]*\/?\s*>/g;
const XML_TAG_RE = /<[^>]+>/g;
const XML_ENTITY_RE = /&(?:amp|lt|gt|quot|apos|#(\d+)|#x([0-9a-f]+));/gi;
const XML_NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodeXmlEntity(match: string, dec?: string, hex?: string) {
  if (dec) return String.fromCodePoint(Number(dec));
  if (hex) return String.fromCodePoint(parseInt(hex, 16));
  return XML_NAMED_ENTITIES[match] || match;
}

export function extractDocxText(buffer: Buffer) {
  // Read ZIP central directory; standard DOCX files are ZIP archives.
  let eocd = -1;
  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 65557);
    i--
  ) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Invalid DOCX archive.");
  const size = buffer.readUInt32LE(eocd + 12),
    offset = buffer.readUInt32LE(eocd + 16);
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
    const name = buffer
      .subarray(pos + 46, pos + 46 + fileNameLen)
      .toString("utf8");
    pos += 46 + fileNameLen + extraLen + commentLen;
    if (name !== "word/document.xml") continue;
    if (uncompressed > 15 * 1024 * 1024)
      throw new Error("DOCX document is too large.");
    if (
      localOffset + 30 > buffer.length ||
      buffer.readUInt32LE(localOffset) !== 0x04034b50
    )
      throw new Error("Invalid DOCX contents.");
    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    if (start + compressed > buffer.length)
      throw new Error("Invalid DOCX compression length.");
    const data = buffer.subarray(start, start + compressed);
    const xml = (
      method === 8
        ? inflateRawSync(data, { maxOutputLength: 15 * 1024 * 1024 })
        : method === 0
          ? data
          : (() => {
              throw new Error("Unsupported DOCX compression");
            })()
    ).toString("utf8");
    return xml
      .replace(XML_PARAGRAPH_END_RE, "\n")
      .replace(XML_TAB_RE, "\t")
      .replace(XML_BREAK_RE, "\n")
      .replace(XML_TAG_RE, "")
      .replace(XML_ENTITY_RE, decodeXmlEntity);
  }
  throw new Error("DOCX is missing word/document.xml.");
}
