const DEGREE_RE =
  /^(Bachelor[^:]*|Master[^:]*|Associate[^:]*|Doctor[^:]*|PhD|B\.?S\.?|M\.?S\.?)(?::|\s+in\s+|$)\s*(.*)/i;
const INSTITUTION_RE = /university|college|institute|school/i;
const INSTITUTION_LOCATION_SPLIT_RE = /\s+[-–—]\s+/;
const PIPE_SPLIT_RE = /\s*\|\s*/;

export function extractEducation(lines: string[] = []) {
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
