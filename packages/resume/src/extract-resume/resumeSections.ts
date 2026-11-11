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

export function isSectionHeading(line: string) {
  const heading = line.replace(HEADING_TRAILING_COLON_RE, "");
  return Object.values(sectionNames).some((pattern) => pattern.test(heading));
}

export function resumeSections(lines: string[]) {
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
