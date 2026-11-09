// Local, conservative resume work-history extraction; no invented employment entries.
const BEGIN =
  /^(?:professional experience|work experience|employment history|work history|relevant experience|career history|career experience|professional background|employment experience|experience)$/i;
const END =
  /^(?:education(?:\s+&\s+training)?|academic background|skills|technical skills|technical competencies|core competencies|technical expertise|projects|certifications|awards|summary|profile|languages|publications|volunteering|additional information|references)$/i;
const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const D =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?\\s+\\d{4}|\\d{1,2}/\\d{4}|\\d{4}[-/]\\d{1,2}|\\d{4}";
const RANGE = new RegExp(
  "(" +
    D +
    ")\\s*(?:–|—|−|-|\\bto\\b)\\s*(Present|Current|Now|Ongoing|" +
    D +
    ")(?!\\d)",
  "i",
);
const TITLE =
  /\b(?:engineer|developer|manager|director|analyst|consultant|architect|designer|lead|specialist|intern|researcher|scientist|administrator|coordinator|technician|founder|owner|executive|product|sales|operations|support|programmer|devops|sre|qa)\b/i;
const COMPANY =
  /\b(?:inc\.?|llc|ltd\.?|corp\.?|company|technologies|technology|solutions|systems|group|labs|bank|university|software|consulting)\b/i;
const BULLET = /^(?:[-*●•▪◦‣⁃]|\d+[.)])\s*/u;
function date(value: string) {
  if (/^(?:present|current|now|ongoing)$/i.test(value)) return null;
  const m = value
    .replace(/\./g, "")
    .trim()
    .match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const n = MONTHS.findIndex((x) => m[1].toLowerCase().startsWith(x));
    return n < 0 ? null : m[2] + "-" + String(n + 1).padStart(2, "0");
  }
  const a = value.match(/^(\d{4})[-/](\d{1,2})$/),
    b = value.match(/^(\d{1,2})\/(\d{4})$/);
  if (a)
    return +a[2] >= 1 && +a[2] <= 12
      ? a[1] + "-" + a[2].padStart(2, "0")
      : null;
  if (b)
    return +b[1] >= 1 && +b[1] <= 12
      ? b[2] + "-" + b[1].padStart(2, "0")
      : null;
  return /^\d{4}$/.test(value) ? value : null;
}
function clean(s: string) {
  return s.replace(/^[\s|,:;–—-]+|[\s|,:;–—-]+$/g, "").trim();
}
function header(s: string | undefined) {
  return (
    !!s &&
    s.length < 160 &&
    !BULLET.test(s) &&
    (!/[.!?]$/.test(s) || /\b(?:Inc|LLC|Ltd|Corp|Co)\.$/i.test(s)) &&
    !/@|https?:/i.test(s) &&
    !END.test(s.replace(/[:：]$/, ""))
  );
}
function identity(lines: string[], fallbackCompany = "") {
  const p = lines
    .flatMap((x) => x.split(/\s+[|•]\s+/))
    .map(clean)
    .filter(Boolean);
  let company = "",
    jobTitle = "",
    location = "";
  if (p.length === 1) {
    const m = p[0].match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
    if (m) {
      jobTitle = m[1];
      company = m[2];
    } else if (TITLE.test(p[0]) && fallbackCompany) {
      jobTitle = p[0];
      company = fallbackCompany;
    } else return null;
  } else if (p.length >= 2) {
    const t = p.findIndex((x) => TITLE.test(x));
    if (t < 0) return null;
    jobTitle = p[t];
    const c = p.findIndex((x, i) => i !== t && COMPANY.test(x));
    const other = p.findIndex(
      (x, i) =>
        i !== t &&
        !/^(?:remote|hybrid|on-site|onsite)$/i.test(x) &&
        !/^.{2,40},\s*[A-Z]{2}$/.test(x),
    );
    company = p[c >= 0 ? c : other] || fallbackCompany;
    location = p.find((x) => x !== company && x !== jobTitle) || "";
  }
  return company &&
    jobTitle &&
    company !== jobTitle &&
    header(company) &&
    header(jobTitle)
    ? { company, jobTitle, location }
    : null;
}
export function extractEmploymentHistory(text: unknown) {
  if (typeof text !== "string") return [];
  const all = text.replaceAll("\u0002", "-").replaceAll("\u00ad", "-").split(/\r?\n/).map((x) => x.trim());
  const start = all.findIndex((x) => BEGIN.test(x.replace(/[:：]$/, "")));
  if (start < 0) return [];
  const lines: string[] = [];
  for (const line of all.slice(start + 1)) {
    if (END.test(line.replace(/[:：]$/, ""))) break;
    lines.push(line);
  }
  const jobs: Array<{
    company: string;
    jobTitle: string;
    location: string;
    startDate: string;
    endDate: string | null;
    isCurrent: boolean;
    begin: number;
    end: number;
  }> = [];
  for (let i = 0; i < lines.length; i++) {
    const m = RANGE.exec(lines[i]);
    if (!m) continue;
    const startDate = date(m[1]),
      isCurrent = /^(?:present|current|now|ongoing)$/i.test(m[2]),
      endDate = isCurrent ? null : date(m[2]);
    if (!startDate || (!isCurrent && !endDate)) continue;
    const prefix = clean(lines[i].slice(0, m.index)),
      suffix = clean(lines[i].slice(m.index + m[0].length)),
      parts = prefix ? [prefix] : [];
    let begin = i;
    for (
      let k = i - 1;
      k >= Math.max(0, i - 3) &&
      parts.length < 3 &&
      !/\s+[|•]\s+|\s+(?:at|@)\s+/i.test(prefix);
      k--
    ) {
      if (!lines[k]) {
        if (parts.length) break;
        else continue;
      }
      if (!header(lines[k]) || RANGE.test(lines[k])) break;
      parts.unshift(lines[k]);
      begin = k;
    }
    // Company/date followed by a title is common in PDF reading order.
    // Keep an intervening division/team line as context rather than the employer.
    let id = null,
      end = i;
    if (
      prefix &&
      header(lines[i + 1]) &&
      TITLE.test(lines[i + 1]) &&
      !RANGE.test(lines[i + 1])
    ) {
      const company = parts.length > 1 ? parts[0] : prefix;
      id = {
        company,
        jobTitle: lines[i + 1],
        location: parts.length > 1 ? parts.slice(1).join(" | ") : "",
      };
      end = i + 1;
    }
    if (!id) id = identity(parts);
    if (!id && suffix) id = identity([suffix, ...parts]);
    // A promoted role at the same employer may show only its title and dates.
    if (!id && jobs.length && parts.length === 1)
      id = identity(parts, jobs.at(-1)!.company);
    if (!id && jobs.length && suffix)
      id = identity([suffix], jobs.at(-1)!.company);
    // Some resumes place the date range before the company and job title.
    if (!id && !prefix && !suffix) {
      const following = lines.slice(i + 1, i + 3);
      if (
        following.length === 2 &&
        following.every((x) => header(x) && !RANGE.test(x))
      ) {
        id = identity(following);
        if (id) end = i + 2;
      }
    }
    if (id) jobs.push({ ...id, startDate, endDate, isCurrent, begin, end });
  }
  return jobs.map((j, n) => ({
    company: j.company,
    jobTitle: j.jobTitle,
    location: j.location,
    startDate: j.startDate,
    endDate: j.endDate,
    isCurrent: j.isCurrent,
    description: joinDescription(
      lines.slice(
        j.end + 1,
        n + 1 < jobs.length ? jobs[n + 1].begin : lines.length,
      ),
    ),
  }));
}

// PDF line breaks are visual wrapping; only source bullet markers start new items.
function joinDescription(lines: string[]) {
  if (!lines.some((line) => BULLET.test(line))) {
    const paragraphs: string[] = [];
    let paragraph = "";
    for (const line of lines) {
      const text = line.trim();
      if (!text) {
        if (paragraph) paragraphs.push(paragraph);
        paragraph = "";
        continue;
      }
      paragraph += (paragraph ? " " : "") + text;
      // PDF text wraps at the page edge. End a responsibility at sentence
      // punctuation, rather than turning each physical line into a Slate bullet.
      if (/[.!?][”"')\]]?$/.test(text)) {
        paragraphs.push(paragraph);
        paragraph = "";
      }
    }
    if (paragraph) paragraphs.push(paragraph);
    return paragraphs.join("\n");
  }
  const items: string[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (BULLET.test(line) || !items.length)
      items.push((BULLET.test(line) ? "- " : "") + line.replace(BULLET, "").trim());
    else items[items.length - 1] += " " + line.trim();
  }
  return items.join("\n");
}
