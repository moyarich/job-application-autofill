import MarkdownIt from "markdown-it";
import type { CandidateProfile } from "../types.js";
const markdown = new MarkdownIt({ html: false, linkify: false, breaks: true });

/** Render only safe Markdown; raw HTML stays visible text and unsafe links are rejected. */
const sourceLists = (text: string) => text.replace(/^([ \t]*)[•●▪◦‣⁃]\s*/gm, "$1- ");
export const markdownToHtml = (text: string) => markdown.render(sourceLists(text));
export function markdownToPlainText(text: string): string {
  return markdown
    .parse(text, {})
    .map((token) => {
      if (token.type === "inline")
        return (token.children || [])
          .map((child) => {
            if (child.type === "softbreak" || child.type === "hardbreak")
              return "\n";
            if (child.type === "image") return child.content;
            return ["text", "code_inline"].includes(child.type)
              ? child.content
              : "";
          })
          .join("");
      if (token.type === "fence" || token.type === "code_block")
        return token.content;
      return ["paragraph_close", "heading_close", "tr_close"].includes(
        token.type,
      )
        ? "\n"
        : "";
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
export function resumeToPlainText(profile: CandidateProfile): CandidateProfile {
  return {
    ...profile,
    summary: markdownToPlainText(profile.summary),
    experience: profile.experience.map((e) => ({
      ...e,
      description: markdownToPlainText(e.description),
    })),
    education: profile.education.map((e) => ({
      ...e,
      description: markdownToPlainText(e.description),
    })),
    projects: profile.projects.map((e) => ({
      ...e,
      description: markdownToPlainText(e.description),
    })),
    ...(profile.additionalSections
      ? {
          additionalSections: profile.additionalSections.map((s) => ({
            ...s,
            content: markdownToPlainText(s.content),
          })),
        }
      : {}),
  };
}

export type RichTextLeaf = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  href?: string;
};
export type RichTextBlock = {
  type: "paragraph" | "bullet" | "numbered";
  prefix?: string;
  children: RichTextLeaf[];
};
export type RichTextDocument = RichTextBlock[];
/** A deliberately small resume editor vocabulary, serialized into the existing Markdown string. */
export function markdownToEditor(
  text: string,
  bullets = false,
): RichTextDocument {
  return sourceLists(text).split("\n").map((line) => {
    const prefix = line.match(/^(\s*(?:[-*+] |\d+[.)] |#{1,6} |> ))/)?.[0] || "";
    const numbered = /^\s*\d+[.)] /.test(prefix);
    const bullet = /^\s*[-*+] /.test(prefix);
    const children: RichTextLeaf[] = [];
    let bold = false,
      italic = false,
      href: string | undefined;
    for (const token of markdown.parseInline(line.slice(prefix.length), {})[0]
      ?.children || []) {
      if (token.type === "strong_open") bold = true;
      else if (token.type === "strong_close") bold = false;
      else if (token.type === "em_open") italic = true;
      else if (token.type === "em_close") italic = false;
      else if (token.type === "link_open")
        href = token.attrGet("href")
          ? String(token.attrGet("href"))
          : undefined;
      else if (token.type === "link_close") href = undefined;
      else if (token.type === "text" || token.type === "code_inline")
        children.push({
          text: token.content,
          ...(bold ? { bold: true } : {}),
          ...(italic ? { italic: true } : {}),
          ...(href ? { href } : {}),
          ...(token.type === "code_inline" ? { code: true } : {}),
        });
      else if (token.type === "image") children.push({ text: token.content });
    }
    return {
      type: numbered ? "numbered" : bullet || bullets ? "bullet" : "paragraph",
      prefix: prefix || (bullets ? "- " : ""),
      children: children.length ? children : [{ text: "" }],
    };
  });
}
/** Keep each list marker and its indentation in the Markdown representation. */
export function listDepth(block: RichTextBlock): number {
  return (block.prefix?.match(/^[ \t]*/)?.[0].replace(/\t/g, "    ").length ?? 0);
}

export function setListStyle(
  block: RichTextBlock,
  type: RichTextBlock["type"],
): Pick<RichTextBlock, "type" | "prefix"> {
  const indent = " ".repeat(listDepth(block));
  if (type === "paragraph") return { type, prefix: "" };
  const existing = block.prefix?.trim() ?? "";
  const marker = type === "numbered"
    ? (/^\d+[.)]$/.test(existing) ? existing : "1.")
    : (/^[-*+]$/.test(existing) ? existing : "-");
  return { type, prefix: indent + marker + " " };
}

/** Four spaces per level keeps mixed and numbered sublists portable. */
export function shiftListIndent(
  block: RichTextBlock,
  direction: 1 | -1,
): Pick<RichTextBlock, "type" | "prefix"> {
  if (block.type === "paragraph") return { type: block.type, prefix: block.prefix ?? "" };
  const depth = Math.max(0, listDepth(block) + direction * 4);
  const marker = (block.prefix ?? "").trim() || (block.type === "numbered" ? "1." : "-");
  return { type: block.type, prefix: " ".repeat(depth) + marker + " " };
}

export function editorToMarkdown(document: RichTextDocument): string {
  return document
    .map((block) => {
      const contents = block.children
        .map((leaf) => {
          let text = leaf.text.replace(/([\\`*_[\]<>])/g, "\\$1");
          if (leaf.code) text = "`" + leaf.text.replace(/`/g, "\\`") + "`";
          if (leaf.bold && text) text = "**" + text + "**";
          if (leaf.italic && text) text = "*" + text + "*";
          if (leaf.href)
            text =
              "[" +
              text +
              "](" +
              leaf.href.replace(/[()\s]/g, encodeURIComponent) +
              ")";
          return text;
        })
        .join("");
      return (
        (block.type === "bullet" || block.type === "numbered"
          ? /^\s*(?:[-*+] |\d+[.)] )/.test(block.prefix || "")
            ? block.prefix
            : block.type === "numbered" ? "1. " : "- "
          : block.prefix && !/^\s*(?:[-*+] |\d+[.)] )/.test(block.prefix)
            ? block.prefix
            : "") + contents
      );
    })
    .join("\n");
}



/** Compose a portable Markdown document from the same structured resume fields. */
export function resumeToMarkdown(profile: CandidateProfile): string {
  const text = (value: string) => value.replace(/([\\`*_[\]<>#])/g, "\\$1");
  const contact = profile.contact;
  const section = (name: string, contents: string) =>
    contents.trim() ? "## " + name + "\n\n" + contents.trim() + "\n\n" : "";
  const entry = (title: string, metadata: string[], description = "") =>
    "### " +
    text(title) +
    "\n\n" +
    metadata.filter(Boolean).map(text).join(" | ") +
    "\n\n" +
    description +
    "\n\n";
  return (
    (
      "# " +
      text([contact.firstName, contact.lastName].filter(Boolean).join(" ")) +
      "\n\n" +
      [
        contact.email,
        contact.phone,
        contact.location,
        contact.linkedIn,
        contact.github,
        contact.website,
      ]
        .filter(Boolean)
        .map(text)
        .join(" | ") +
      "\n\n" +
      section("Professional Summary", profile.summary) +
      section(
        "Work Experience",
        profile.experience
          .map((e) =>
            entry(
              e.jobTitle,
              [
                e.company,
                e.location,
                [e.startDate, e.isCurrent ? "Present" : e.endDate]
                  .filter(Boolean)
                  .join(" – "),
              ],
              e.description,
            ),
          )
          .join(""),
      ) +
      section(
        "Skills",
        profile.skillGroups?.length
          ? profile.skillGroups
              .map((g) => "**" + text(g.heading) + ":** " + text(g.content))
              .join("\n\n")
          : profile.skills.map(text).join(", "),
      ) +
      section(
        "Education",
        profile.education
          .map((e) =>
            entry(
              e.institution,
              [
                e.degree,
                e.fieldOfStudy,
                e.location,
                [e.startDate, e.endDate].filter(Boolean).join(" – "),
              ],
              e.description,
            ),
          )
          .join(""),
      ) +
      section(
        "Projects",
        profile.projects
          .map((e) =>
            entry(e.name, [e.url, e.technologies.join(", ")], e.description),
          )
          .join(""),
      ) +
      section(
        "Certifications",
        profile.certifications
          .map((e) =>
            entry(e.name, [
              e.issuer,
              e.issuedDate,
              e.expirationDate ? "Expires " + e.expirationDate : "",
              e.credentialId,
              e.url,
            ]),
          )
          .join(""),
      ) +
      section("Languages", profile.languages.map(text).join(", ")) +
      section("Awards", profile.awards.map((a) => "- " + text(a)).join("\n")) +
      (profile.additionalSections || [])
        .map((s) => section(text(s.heading), s.content))
        .join("")
    ).trim() + "\n"
  );
}
