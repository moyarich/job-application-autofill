import { extractEmploymentHistory } from "./experience.js";
import { getPdfPython, resumePackageDir } from "./python-runtime.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { inflateRawSync } from "node:zlib";
const execFileAsync = promisify(execFile);
const MAX_RESUME = 10 * 1024 * 1024;
const skillWords = [
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Vue",
  "Node.js",
  "Python",
  "FastAPI",
  "AWS",
  "Docker",
  "Kubernetes",
  "PostgreSQL",
  "DynamoDB",
  "Redis",
  "GraphQL",
  "Java",
  "C#",
  "Go",
  "SQL",
  "Playwright",
  "Git",
  "Azure",
  "GCP",
  "LangChain",
  "Machine Learning",
  "Generative AI",
];
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
  const ext = payload.fileName.toLowerCase().match(/\.(pdf|docx)$/)?.[1];
  if (!ext) throw new Error("Only PDF and DOCX resumes are supported.");
  if (payload.base64.length > Math.ceil((MAX_RESUME * 4) / 3) + 8)
    throw new Error("Resume exceeds 10 MB.");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(payload.base64))
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
    fileName: payload.fileName.replace(/[^a-z0-9._-]/gi, "_"),
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
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:tab\b[^>]*\/?\s*>/g, "\t")
      .replace(/<w:br\b[^>]*\/?\s*>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(
        /&(?:amp|lt|gt|quot|apos|#(\d+)|#x([0-9a-f]+));/gi,
        (match, dec, hex) => {
          if (dec) return String.fromCodePoint(Number(dec));
          if (hex) return String.fromCodePoint(parseInt(hex, 16));
          return (
            (
              {
                "&amp;": "&",
                "&lt;": "<",
                "&gt;": ">",
                "&quot;": '"',
                "&apos;": "'",
              } as Record<string, string>
            )[match] || match
          );
        },
      );
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
  const { join, resolve } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "moya-resume-"));
  try {
    const input = join(dir, "resume.pdf");
    await writeFile(input, buffer, { mode: 0o600 });
    const python = await getPdfPython();
    const script = resolve(resumePackageDir(), "python/pdf_ocr.py");
    const { stdout } = await execFileAsync(python, [script, input], {
      timeout: 120000,
      maxBuffer: 15 * 1024 * 1024,
      windowsHide: true,
    });
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
function resumeSections(lines: string[]) {
  const sections: Record<string, string[]> = {};
  let current = "";
  const additionalSections: { heading: string; content: string }[] = [];
  for (const line of lines) {
    const heading = line.replace(/[:：]$/, "");
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
    const degree = line.match(
      /^(Bachelor[^:]*|Master[^:]*|Associate[^:]*|Doctor[^:]*|PhD|B\.?S\.?|M\.?S\.?)(?::|\s+in\s+|$)\s*(.*)/i,
    );
    if (degree && entries.length) {
      Object.assign(entries.at(-1)!, {
        degree: degree[1],
        fieldOfStudy: degree[2],
      });
    } else if (/university|college|institute|school/i.test(line)) {
      const [institution, location = ""] = line.split(/\s+[-–—]\s+/);
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
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const contactText = lines
    .slice(
      0,
      lines.findIndex((line) =>
        Object.values(sectionNames).some((pattern) =>
          pattern.test(line.replace(/[:：]$/, "")),
        ),
      ) >>> 0,
    )
    .join("\n");
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = text.match(/(?:\+?\d[\d\s.()-]{8,}\d)/)?.[0]?.trim() || "";
  const linkedIn =
    text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i)?.[0] ||
    "";
  const github =
    text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/i)?.[0] || "";
  const website =
    contactText.match(
      /https?:\/\/(?!www\.(?:linkedin|github)\.com)[^\s)]+/i,
    )?.[0] || "";
  const heading =
    lines.find(
      (line) =>
        line.length <= 65 &&
        /^[\p{L}][\p{L} .'-]+$/u.test(line) &&
        line.split(/\s+/).length >= 2 &&
        line.split(/\s+/).length <= 4 &&
        !/resume|experience|skills|education|summary|curriculum/i.test(line),
    ) || "";
  const parts = heading.split(/\s+/).filter(Boolean);
  const { sections, additionalSections } = resumeSections(lines);
  const skillGroups: { heading: string; content: string }[] = [];
  for (const line of sections.skills || []) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) skillGroups.push({ heading: match[1], content: match[2] });
    else if (skillGroups.length) skillGroups.at(-1)!.content += " " + line;
  }
  const skills = skillWords.filter((word) =>
    new RegExp(
      "(^|[^a-z0-9])" +
        word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "($|[^a-z0-9])",
      "i",
    ).test(text),
  );
  // Join wrapped category values before splitting, preserving skills beyond the fallback vocabulary.
  const explicitSkills = (sections.skills || [])
    .map((line) => line.replace(/^[A-Za-z][A-Za-z &/-]*:\s*/, ","))
    .join(" ")
    .split(/[,;•]/)
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
    certifications: (sections.certifications || []).map((name) => ({
      name,
      issuer: /^AWS Certified\b/i.test(name) ? "Amazon Web Services" : "",
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
