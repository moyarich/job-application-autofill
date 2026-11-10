import {
  resumeToMarkdown,
  markdownToEditor,
  markdownToPlainText,
} from "@moyarich/resume/markdown";
import { Resume } from "@moyarich/resume";

import { generateResumePdf } from "../../api/resumes";
import { downloadJson, downloadText } from "./resume-files";

export type ResumeExportFormat =
  "txt" | "yaml" | "json" | "pdf" | "docx" | "md";

export const resumeExportFormats = [
  ["txt", "Text"],
  ["yaml", "YAML"],
  ["json", "JSON"],
  ["pdf", "PDF"],
  ["docx", "Word"],
  ["md", "Markdown"],
] as const;

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function createResumeWord(profile: Resume): Promise<Blob> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    ExternalHyperlink,
  } = await import("docx");
  const blocks = markdownToEditor(resumeToMarkdown(profile));
  const children = blocks
    .filter((block) => block.children.some((leaf) => leaf.text.trim()))
    .map((block) => {
      const level = block.prefix?.trim().match(/^#+$/)?.[0].length;
      const runs = block.children.map((leaf) => {
        const run = new TextRun({
          text: leaf.text,
          bold: leaf.bold,
          italics: leaf.italic,
          font: leaf.code ? "Courier New" : "Calibri",
        });
        return leaf.href
          ? new ExternalHyperlink({ link: leaf.href, children: [run] })
          : run;
      });
      return new Paragraph({
        children: runs,
        ...(level
          ? {
              heading:
                level === 1
                  ? HeadingLevel.TITLE
                  : level === 2
                    ? HeadingLevel.HEADING_1
                    : HeadingLevel.HEADING_2,
            }
          : {}),
        ...(block.type === "bullet" ? { bullet: { level: 0 } } : {}),
        spacing: { after: level ? 160 : 70 },
        keepNext: !!level,
      });
    });
  return Packer.toBlob(
    new Document({
      styles: {
        default: {
          document: {
            run: { font: "Calibri", size: 22, color: "182338" },
            paragraph: { spacing: { line: 276 } },
          },
        },
        paragraphStyles: [
          {
            id: "Title",
            name: "Title",
            basedOn: "Normal",
            run: { size: 36, bold: true, color: "182338" },
          },
          {
            id: "Heading1",
            name: "Heading 1",
            basedOn: "Normal",
            run: { size: 25, bold: true, color: "182338" },
          },
          {
            id: "Heading2",
            name: "Heading 2",
            basedOn: "Normal",
            run: { size: 23, bold: true, color: "182338" },
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 900, right: 1080, bottom: 900, left: 1080 },
            },
          },
          children,
        },
      ],
    }),
  );
}
export async function exportResume(
  profile: Resume,
  name: string,
  format: ResumeExportFormat,
  profileId: string,
  resumeId: string,
) {
  const filename = name.replace(/[^a-z0-9._-]+/gi, "-") || "resume";
  if (format === "json") return downloadJson(filename + ".json", profile);
  if (format === "yaml") {
    const { stringify } = await import("yaml");
    return downloadText(
      filename + ".yaml",
      stringify(profile),
      "application/yaml",
    );
  }
  if (format === "docx")
    return downloadBlob(filename + ".docx", await createResumeWord(profile));
  if (format === "pdf") {
    const result = await generateResumePdf(profile, profileId, resumeId);
    const bytes = Uint8Array.from(atob(result.base64), (char) =>
      char.charCodeAt(0),
    );
    return downloadBlob(
      filename + ".pdf",
      new Blob([bytes], { type: "application/pdf" }),
    );
  }
  const markdown = resumeToMarkdown(profile);
  return downloadText(
    filename + "." + format,
    format === "md" ? markdown : markdownToPlainText(markdown),
    format === "md" ? "text/markdown" : "text/plain",
  );
}
