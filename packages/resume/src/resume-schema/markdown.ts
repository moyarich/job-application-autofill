import MarkdownIt from "markdown-it";
import type { CandidateProfile } from "../types.js";
import { parseInlineMarkdown, stringifyInlineMarkdown, markdownListLevels } from "./editor-markdown.ts";
const markdown = new MarkdownIt({ html: false, linkify: false, breaks: true });
// Markdown markers retain the visual style selected in the resume editor.
markdown.renderer.rules.list_item_open = (tokens, index, options, _env, renderer) => {
  const marker = tokens[index].markup;
  if (marker === "*" || marker === "+") {
    tokens[index].attrSet("style", `list-style-type: ${marker === "*" ? "circle" : "square"}`);
  }
  return renderer.renderToken(tokens, index, options);
};

/** Render only safe Markdown; raw HTML stays visible text and unsafe links are rejected. */
const sourceLists = (text: string) => text.replace(/^([ \t]*)([•●▪◦‣⁃])\s*/gm, (_match, indent: string, marker: string) => indent + (marker === "◦" ? "*" : marker === "▪" ? "+" : "-") + " ");
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
    const children = parseInlineMarkdown(line.slice(prefix.length));
    return {
      type: numbered ? "numbered" : bullet || bullets ? "bullet" : "paragraph",
      prefix: prefix || (bullets ? "- " : ""),
      children: children.length ? children : [{ text: "" }],
    };
  });
}
/** Keep each list marker and its indentation in the Markdown representation. */
/** Resolve visual nesting from Markdown structure, including wide ordered markers. */
export function listNestingLevels(document: RichTextDocument): number[] {
  return markdownListLevels(editorToMarkdown(document), document.length);
}

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
  const marker = direction === 1 && block.type === "numbered"
    ? "1."
    : (block.prefix ?? "").trim() || (block.type === "numbered" ? "1." : "-");
  return { type: block.type, prefix: " ".repeat(depth) + marker + " " };
}

/**
 * Number contiguous ordered lists separately at each indentation level.
 * Nested lists do not interrupt numbering in their parent ordered list.
 * The first explicit number in each sequence remains the starting number.
 */
export function renumberListBlocks(document: RichTextDocument): RichTextDocument {
  const counters = new Map<number, number>();
  return document.map((block) => {
    if (block.type === "paragraph") {
      counters.clear();
      return block;
    }
    const depth = listDepth(block);
    for (const level of counters.keys()) {
      if (level > depth) counters.delete(level);
    }
    if (block.type === "bullet") {
      counters.delete(depth);
      return block;
    }
    const current = block.prefix?.trim() ?? "";
    const match = current.match(/^(\d+)([.)])$/);
    const next = counters.has(depth)
      ? counters.get(depth)! + 1
      : match ? Number(match[1]) : 1;
    counters.set(depth, next);
    const prefix = " ".repeat(depth) + next + (match?.[2] ?? ".") + " ";
    return prefix === block.prefix ? block : { ...block, prefix };
  });
}

export function editorToMarkdown(document: RichTextDocument): string {
  return document
    .map((block) => {
      const contents = stringifyInlineMarkdown(block.children);
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
