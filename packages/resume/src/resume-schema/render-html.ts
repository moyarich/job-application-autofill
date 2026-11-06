import { markdownToHtml } from "./markdown.ts";
import type { CandidateProfile } from "../types.js";
import { validateResume } from "./validate.ts";

// Chromium embeds the fonts used to render the HTML in its PDF output.
// HTML is escaped at the boundary; resume fields must never be interpreted as markup.
const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      (
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }) as Record<string, string>
      )[ch],
  );
const el = (tag: string, value: unknown, className = "") =>
  "<" +
  tag +
  (className ? ' class="' + className + '"' : "") +
  ">" +
  escapeHtml(value) +
  "</" +
  tag +
  ">";
const recent = <T extends { startDate: string }>(items: T[]) =>
  [...items].sort((a, b) =>
    (b.startDate || "").localeCompare(a.startDate || ""),
  );
function date(value: string | null) {
  if (!value) return "";
  if (/^\d{4}$/.test(value)) return value;
  const [year, month] = value.split("-");
  return (
    [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ][Number(month) - 1] +
    " " +
    year
  );
}
const period = (item: {
  startDate: string;
  endDate: string | null;
  isCurrent?: boolean;
}) =>
  [date(item.startDate), item.isCurrent ? "Present" : date(item.endDate)]
    .filter(Boolean)
    .join(" – ");
const inline = (parts: string[]) =>
  parts
    .filter(Boolean)
    .map(escapeHtml)
    .join(' <span class="divider">|</span> ');
const section = (heading: string, contents: string) =>
  contents
    ? "<section><h2>" + escapeHtml(heading) + "</h2>" + contents + "</section>"
    : "";
function entry(
  title: string,
  metadata: string,
  when: string,
  description: string,
) {
  const details = description
    ? markdownToHtml(
        /^\s*(?:[-*+] |\d+\. |#{1,6} |> |```)/m.test(description)
          ? description
          : description
              .split(/\r?\n/)
              .filter((line) => line.trim())
              .map((line) => "- " + line.replace(/^[•●▪◦‣⁃]\s*/, ""))
              .join("\n"),
      )
    : "";
  return (
    "<article>" +
    el("h3", title) +
    (metadata ? '<div class="meta">' + metadata + "</div>" : "") +
    (when ? el("div", when, "period") : "") +
    details +
    "</article>"
  );
}

/** Generate print-ready HTML, escaping every user-controlled field. */
export function renderResumeHtml(input: unknown) {
  const p = validateResume(input) as CandidateProfile;
  const c = p.contact;
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
  const experience = [...p.experience]
    .sort(
      (a, b) =>
        Number(b.isCurrent) - Number(a.isCurrent) ||
        b.startDate.localeCompare(a.startDate),
    )
    .map((e) =>
      entry(
        e.jobTitle,
        inline([e.company, e.location]),
        period(e),
        e.description,
      ),
    )
    .join("");
  const education = recent(p.education)
    .map((e) =>
      entry(
        e.institution,
        inline([e.degree, e.fieldOfStudy, e.location]),
        period(e),
        e.description,
      ),
    )
    .join("");
  const projects = p.projects
    .map((e) =>
      entry(
        e.name,
        el("span", e.url),
        e.technologies.join(", "),
        e.description,
      ),
    )
    .join("");
  const certs = p.certifications
    .map((e) =>
      entry(
        e.name,
        inline([e.issuer, date(e.issuedDate)]),
        [e.credentialId, e.url].filter(Boolean).join(" | "),
        "",
      ),
    )
    .join("");
  const list = (values: string[]) => values.map((v) => el("li", v)).join("");
  const html = [
    el("h1", name),
    '<div class="contact">' + inline([c.location, c.phone, c.email]) + "</div>",
    '<div class="links">' +
      inline([c.linkedIn, c.github, c.website]) +
      "</div>",
    section("Professional Summary", markdownToHtml(p.summary)),
    section("Work Experience", experience),
    section(
      "Skills",
      p.skillGroups?.length
        ? p.skillGroups
            .map(
              (g) =>
                "<p><strong>" +
                escapeHtml(g.heading) +
                ":</strong> " +
                escapeHtml(g.content) +
                "</p>",
            )
            .join("")
        : p.skills.length
          ? el("p", p.skills.join(", "))
          : "",
    ),
    section("Education", education),
    section("Projects", projects),
    section("Certifications", certs),
    section(
      "Languages",
      p.languages.length ? el("p", p.languages.join(", ")) : "",
    ),
    section("Awards", p.awards.length ? "<ul>" + list(p.awards) + "</ul>" : ""),
    ...(p.additionalSections || []).map((s) =>
      section(s.heading, markdownToHtml(s.content)),
    ),
  ].join("");
  return `<!doctype html><html lang="und"><head><meta charset="UTF-8"><style>
    @page { size: letter; margin: 0.68in 0.75in; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font: 10pt/1.42 "Noto Sans", "Noto Sans CJK SC", "Noto Sans Arabic",
      "Noto Sans Devanagari", "Noto Color Emoji", sans-serif; color: #111; }
    h1 { font-size: 17pt; line-height: 1.25; margin: 0 0 5pt; }
    h2 { font-size: 10.5pt; text-transform: uppercase; border-bottom: 0.5pt solid #666;
      margin: 14pt 0 6pt; padding-bottom: 4pt; break-after: avoid; }
    h3 { font-size: 10.5pt; margin: 0 0 2pt; break-after: avoid; }
    p { margin: 0 0 5pt; white-space: pre-wrap; overflow-wrap: anywhere; }
    article { margin-bottom: 9pt; break-inside: auto; }
    .contact, .links, .meta, .period { font-size: 9.5pt; overflow-wrap: anywhere; }
    .meta, .period { break-after: avoid; }
    .divider { color: #666; margin: 0 3pt; }
    ul { margin: 4pt 0 5pt; padding-left: 16pt; }
    li { margin: 2pt 0; overflow-wrap: anywhere; break-inside: avoid; }
    section { break-inside: auto; }
  </style></head><body>${html}</body></html>`;
}
