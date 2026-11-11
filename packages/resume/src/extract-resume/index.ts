import { extractEmploymentHistory } from "./experience.ts";
import { getPdfPython } from "./python-runtime.ts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { inflateRawSync } from "node:zlib";
import { skillWords } from "./skillWords.ts";
const execFileAsync = promisify(execFile);
const MAX_RESUME = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Regex constants
// None of the shared patterns use the `g` flag with `.test()`/`.match()`, so
// there is no stateful `lastIndex` hazard. `g` patterns are only used with
// `.replace()`, which resets `lastIndex`.
// ---------------------------------------------------------------------------

// Upload validation
const RESUME_EXT_RE = /\.(pdf|docx)$/;
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
const UNSAFE_FILENAME_CHARS_RE = /[^a-z0-9._-]/gi;

// DOCX XML -> text
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

// Section headings
const HEADING_TRAILING_COLON_RE = /[:：]$/;
const sectionNames = {
  summary: /^(?:professional summary|summary|profile|professional profile)$/i,
  skills: /^(?:technical skills|skills|core competencies)$/i,
  experience:
    /^(?:professional experience|work experience|experience|employment history)$/i,
  education: /^(?:education|academic background)$/i,
  certifications:
    /^(?:certification|certifications|licenses and certifications)$/i,
  projects: /^projects$/i,
  languages: /^languages$/i,
  awards: /^awards$/i,
  other:
    /^(?:community leadership(?: and technical writing)?|technical writing|creative technology and design|design portfolio)$/i,
};

// Education
const DEGREE_RE =
  /^(Bachelor[^:]*|Master[^:]*|Associate[^:]*|Doctor[^:]*|PhD|B\.?S\.?|M\.?S\.?)(?::|\s+in\s+|$)\s*(.*)/i;
const INSTITUTION_RE = /university|college|institute|school/i;
const INSTITUTION_LOCATION_SPLIT_RE = /\s+[-–—]\s+/;
const PIPE_SPLIT_RE = /\s*\|\s*/;

// Profile / contact
const LINE_BREAK_RE = /\r?\n/;
const WHITESPACE_RE = /\s+/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s.()-]{8,}\d)/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i;
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/i;
const WEBSITE_RE = /https?:\/\/(?!www\.(?:linkedin|github)\.com)[^\s)]+/i;
const NAME_CHARS_RE = /^[\p{L}][\p{L} .'-]+$/u;
const NON_NAME_WORDS_RE =
  /resume|experience|skills|education|summary|curriculum/i;

// Skills
const SKILL_GROUP_RE = /^([^:]+):\s*(.*)$/;
const SKILL_CATEGORY_PREFIX_RE = /^[A-Za-z][A-Za-z &/-]*:\s*/;
const SKILL_SPLIT_RE = /[,;•]/;
const REGEXP_SPECIAL_CHARS_RE = /[.*+?^${}()|[\]\\]/g;

// Certifications
const AWS_ISSUER_LINE_RE = /^Amazon Web Services(?:\s*\(AWS\))?$/i;
const AWS_CERT_RE = /^AWS Certified\b/i;

// ---------------------------------------------------------------------------

function escapeRegExp(value: string) {
  return value.replace(REGEXP_SPECIAL_CHARS_RE, "\\$&");
}

function isSectionHeading(line: string) {
  const heading = line.replace(HEADING_TRAILING_COLON_RE, "");
  return Object.values(sectionNames).some((pattern) => pattern.test(heading));
}

function decodeXmlEntity(match: string, dec?: string, hex?: string) {
  if (dec) return String.fromCodePoint(Number(dec));
  if (hex) return String.fromCodePoint(parseInt(hex, 16));
  return XML_NAMED_ENTITIES[match] || match;
}

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

export async function extractResumeText(
  buffer: Buffer,
  extension: "pdf" | "docx",
) {
  if (extension === "docx") return extractDocxText(buffer);
  // Python PDFium extracts selectable text and invokes RapidOCR only for scanned pages.
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "moya-resume-"));
  try {
    const input = join(dir, "resume.pdf");
    await writeFile(input, buffer, { mode: 0o600 });
    const python = await getPdfPython();
    const { stdout } = await execFileAsync(
      python,
      ["-m", "resume_ocr", input],
      {
        timeout: 120000,
        maxBuffer: 15 * 1024 * 1024,
        windowsHide: true,
      },
    );
    let result;
    try {
      result = JSON.parse(stdout);
    } catch (error) {
      throw new Error("PDF extraction produced an invalid response.", {
        cause: error,
      });
    }
    if (typeof result.text !== "string" || !result.text.trim())
      throw new Error("PDF extraction found no readable text.");
    return result.text;
  } catch (caught) {
    const error = caught as Error & {
      code?: string;
      killed?: boolean;
      stderr?: string;
    };
    if (error.code === "ENOENT")
      throw new Error(
        "Python is required for PDF extraction. Set PYTHON_EXECUTABLE to your virtual environment's Python executable.",
        { cause: caught },
      );
    if (error.killed || error.code === "ETIMEDOUT")
      throw new Error("PDF extraction exceeded the 120-second timeout.", {
        cause: caught,
      });
    if (error.stderr)
      throw new Error(
        `PDF extraction failed: ${error.stderr.toString().trim().slice(0, 700)}`,
        { cause: caught },
      );
    throw error;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function resumeSections(lines: string[]) {
  const sections: Record<string, string[]> = {};
  let current = "";
  const additionalSections: { heading: string; content: string }[] = [];
  for (const line of lines) {
    const heading = line.replace(HEADING_TRAILING_COLON_RE, "");
    const kind = Object.keys(sectionNames).find((key) =>
      sectionNames[key as keyof typeof sectionNames].test(heading),
    );
    if (kind) {
      current = kind;
      if (kind === "other") {
        current = "extra" + additionalSections.length;
        additionalSections.push({ heading, content: "" });
      }
      sections[current] ??= [];
    } else if (current) sections[current].push(line);
  }
  return {
    sections,
    additionalSections: additionalSections.map((entry, i) => ({
      ...entry,
      content: (sections["extra" + i] || []).join("\n"),
    })),
  };
}

function extractEducation(lines: string[] = []) {
  if (!lines.length) return [];
  const entries: Array<{
    institution: string;
    degree: string;
    fieldOfStudy: string;
    location: string;
    startDate: string;
    endDate: string;
    description: string;
  }> = [];
  for (const line of lines) {
    const degree = line.match(DEGREE_RE);
    if (degree && entries.length) {
      const parts = line.split(PIPE_SPLIT_RE);
      Object.assign(entries.at(-1)!, {
        degree: parts.length > 1 ? parts[0] : degree[1],
        fieldOfStudy: parts.length > 1 ? parts[1] : degree[2],
        ...(parts.length > 2 ? { location: parts.slice(2).join(" | ") } : {}),
      });
    } else if (INSTITUTION_RE.test(line)) {
      const [institution, location = ""] = line.split(
        INSTITUTION_LOCATION_SPLIT_RE,
      );
      entries.push({
        institution,
        degree: "",
        fieldOfStudy: "",
        location,
        startDate: "",
        endDate: "",
        description: "",
      });
    } else if (entries.length) {
      entries.at(-1)!.description +=
        (entries.at(-1)!.description ? "\n" : "") + line;
    }
  }
  return entries;
}

export function extractProfile(text: string) {
  // Some PDF fonts encode visible hyphens as control characters.
  text = text.replaceAll("\u0002", "-").replaceAll("\u00ad", "-");
  const lines = text
    .split(LINE_BREAK_RE)
    .map((line) => line.trim())
    .filter(Boolean);
  const contactText = lines
    .slice(0, lines.findIndex(isSectionHeading) >>> 0)
    .join("\n");
  const email = text.match(EMAIL_RE)?.[0] || "";
  const phone = text.match(PHONE_RE)?.[0]?.trim() || "";
  const linkedIn = text.match(LINKEDIN_RE)?.[0] || "";
  const github = text.match(GITHUB_RE)?.[0] || "";
  const website = contactText.match(WEBSITE_RE)?.[0] || "";
  const heading =
    lines.find(
      (line) =>
        line.length <= 65 &&
        NAME_CHARS_RE.test(line) &&
        line.split(WHITESPACE_RE).length >= 2 &&
        line.split(WHITESPACE_RE).length <= 4 &&
        !NON_NAME_WORDS_RE.test(line),
    ) || "";
  const parts = heading.split(WHITESPACE_RE).filter(Boolean);
  const { sections, additionalSections } = resumeSections(lines);
  const skillGroups: { heading: string; content: string }[] = [];
  for (const line of sections.skills || []) {
    const match = line.match(SKILL_GROUP_RE);
    if (match) skillGroups.push({ heading: match[1], content: match[2] });
    else if (skillGroups.length) skillGroups.at(-1)!.content += " " + line;
  }
  // Dynamic per-word patterns can't be constants, but the escaping can be shared.
  const skills = skillWords.filter((word) =>
    new RegExp(
      "(^|[^a-z0-9])" + escapeRegExp(word) + "($|[^a-z0-9])",
      "i",
    ).test(text),
  );
  // Join wrapped category values before splitting, preserving skills beyond the fallback vocabulary.
  const explicitSkills = (sections.skills || [])
    .map((line) => line.replace(SKILL_CATEGORY_PREFIX_RE, ","))
    .join(" ")
    .split(SKILL_SPLIT_RE)
    .map((value) => value.trim())
    .filter(Boolean);
  const parsedSkills = explicitSkills.length
    ? [...new Set(explicitSkills)]
    : skills;
  return {
    contact: {
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" "),
      email,
      phone,
      location: "",
      linkedIn,
      github,
      website,
    },
    additionalSections,
    skillGroups,
    summary: (sections.summary || []).join(" "),
    experience: extractEmploymentHistory(text),
    skills: parsedSkills,
    education: extractEducation(sections.education),
    projects: [],
    certifications: (sections.certifications || [])
      .filter(
        (name, index, lines) =>
          !(
            index > 0 &&
            AWS_ISSUER_LINE_RE.test(name) &&
            AWS_CERT_RE.test(lines[index - 1])
          ),
      )
      .map((name) => ({
        name,
        issuer: AWS_CERT_RE.test(name) ? "Amazon Web Services" : "",
        issuedDate: "",
        expirationDate: null,
        credentialId: "",
        url: "",
      })),
    languages: sections.languages || [],
    awards: sections.awards || [],
    source: { fileName: "" },
  };
}
export { MAX_RESUME, extractEmploymentHistory };
