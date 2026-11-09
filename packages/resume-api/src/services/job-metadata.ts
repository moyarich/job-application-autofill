import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";

export type JobMetadata = { company: string; role: string };

// Do not let a pasted application URL turn the local API into a proxy for
// internal services, cloud metadata endpoints, or Docker/private addresses.
function publicAddress(address: string): boolean {
  if (isIP(address) === 6) return /^[23][0-9a-f]{3}:/i.test(address);
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) ||
      (a === 198 && (b === 18 || b === 19))) return false;
  return true;
}

function jobUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password ||
      url.port || isIP(url.hostname) || url.hostname === "localhost" ||
      !url.hostname.includes("."))
    throw new Error("Enter a public HTTPS job posting URL.");
  return url;
}

async function readPage(url: URL, remainingRedirects = 2): Promise<string> {
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((value) => !publicAddress(value.address)))
    throw new Error("Job URL must resolve to a public website.");
  const address = addresses[0];
  return new Promise<string>((resolve, reject) => {
    const req = request(url, {
      method: "GET",
      timeout: 10000,
      lookup: (_hostname, _options, callback) =>
        callback(null, address.address, address.family),
      headers: {
        Accept: "text/html",
        "Accept-Encoding": "identity",
        "User-Agent": "MoyaJobMetadata/1.0",
      },
    }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (remainingRedirects <= 0) return reject(new Error("Too many redirects."));
        let next: URL;
        try { next = jobUrl(new URL(res.headers.location, url).href); }
        catch { return reject(new Error("Job URL redirects to an unsafe destination.")); }
        void readPage(next, remainingRedirects - 1).then(resolve, reject);
        return;
      }
      if (status !== 200 || !String(res.headers["content-type"] ?? "").toLowerCase().includes("text/html")) {
        res.resume();
        reject(new Error("The job posting did not return an HTML page."));
        return;
      }
      let size = 0;
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 1024 * 1024) {
          req.destroy(new Error("Job posting HTML exceeds 1 MB."));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("Job posting request timed out.")));
    req.on("error", reject);
    req.end();
  });
}

const decode = (value: string) => value
  .replace(/&(?:amp|quot|apos|lt|gt|nbsp|#(\d+)|#x([a-f\d]+));/gi, (match, decimal: string, hex: string) => {
    if (decimal) return String.fromCodePoint(Number(decimal));
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    return ({ "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " " } as Record<string, string>)[match.toLowerCase()] ?? match;
  }).replace(/\s+/g, " ").trim();

function meta(html: string, key: string): string {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
        .map((match) => [match[1].toLowerCase(), match[2] ?? match[3]]),
    );
    if (attributes.property?.toLowerCase() === key || attributes.name?.toLowerCase() === key)
      return decode(attributes.content ?? "");
  }
  return "";
}

function findPosting(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) return value.map(findPosting).find(Boolean);
  const node = value as Record<string, unknown>;
  const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
  if (types.some((type) => typeof type === "string" && /(?:^|\/)JobPosting$/i.test(type)))
    return node;
  return findPosting(node["@graph"]);
}

export function parseJobMetadata(html: string): JobMetadata {
  for (const script of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const posting = findPosting(JSON.parse(script[1]));
      if (posting) {
        const organization = posting.hiringOrganization as { name?: unknown } | undefined;
        const role = typeof posting.title === "string" ? decode(posting.title) : "";
        const company = typeof organization?.name === "string" ? decode(organization.name) : "";
        if (role && company) return { role: role.slice(0, 500), company: company.slice(0, 500) };
      }
    } catch { /* Ignore invalid employer JSON-LD and continue with HTML metadata. */ }
  }
  const pageTitle = meta(html, "og:title") || meta(html, "twitter:title") ||
    decode(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const parts = pageTitle.split(/\s+(?:\||–|—|-)\s+/);
  const role = (parts[0] ?? "").replace(/\s+(?:Jobs?|Careers?|Apply Now)$/i, "").trim();
  const site = meta(html, "og:site_name");
  const generic = /^(workday|linkedin|indeed|greenhouse|lever|jobs?|careers?)$/i;
  const titleCompany = parts.length > 1 ? parts[1].replace(/\s+(?:Jobs?|Careers?)$/i, "").trim() : "";
  const company = site && !generic.test(site) ? site
    : titleCompany && !generic.test(titleCompany) ? titleCompany : "";
  return { role: role.slice(0, 500), company: company.slice(0, 500) };
}

export async function lookupJobMetadata(raw: unknown): Promise<JobMetadata> {
  if (typeof raw !== "string" || raw.length > 4000)
    throw new Error("A job posting URL is required.");
  return parseJobMetadata(await readPage(jobUrl(raw)));
}
