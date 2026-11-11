import type { Resume } from "../types.ts";

/** Compose a portable Markdown document from the same structured resume fields. */
export function resumeToMarkdown(profile: Resume): string {
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
