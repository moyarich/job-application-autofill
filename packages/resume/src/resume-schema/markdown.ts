import MarkdownIt from "markdown-it";
import type { CandidateProfile } from "../types.js";
const markdown = new MarkdownIt({ html: false, linkify: false, breaks: true });
// Markdown markers retain the visual style selected in the resume editor.
markdown.renderer.rules.list_item_open = (
  tokens,
  index,
  options,
  _env,
  renderer,
) => {
  const marker = tokens[index].markup;
  if (marker === "*" || marker === "+") {
    tokens[index].attrSet(
      "style",
      `list-style-type: ${marker === "*" ? "circle" : "square"}`,
    );
  }
  return renderer.renderToken(tokens, index, options);
};

/** Render only safe Markdown; raw HTML stays visible text and unsafe links are rejected. */
export const sourceLists = (text: string) =>
  text.replace(
    /^([ \t]*)([•●▪◦‣⁃])\s*/gm,
    (_match, indent: string, marker: string) =>
      indent + (marker === "◦" ? "*" : marker === "▪" ? "+" : "-") + " ",
  );
export const markdownToHtml = (text: string) =>
  markdown.render(sourceLists(text));
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
