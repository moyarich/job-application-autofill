import { chromium } from "playwright";
import TurndownService from "turndown";
import { load } from "cheerio";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";

export type JobMetadata = {
  company: string;
  role: string;
  details?: {
    location?: string;
    employmentType?: string;
    requisitionId?: string;
    description?: string;
    postingUrl?: string;
    salary?: string;
  };
};

// Do not let a pasted application URL turn the local API into a proxy for
// internal services, cloud metadata endpoints, or Docker/private addresses.
function publicAddress(address: string): boolean {
  if (isIP(address) === 6) return /^[23][0-9a-f]{3}:/i.test(address);
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number);
  if (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) ||
    (a === 198 && (b === 18 || b === 19))
  )
    return false;
  return true;
}

function jobUrl(raw: string): URL {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    isIP(url.hostname) ||
    url.hostname === "localhost" ||
    !url.hostname.includes(".")
  )
    throw new Error("Enter a public HTTPS job posting URL.");
  return url;
}

type Resource = { body: Buffer; contentType: string; cookies: string[] };
async function readResource(
  url: URL,
  remainingRedirects = 2,
  browserHeaders: Record<string, string> = {},
): Promise<Resource> {
  const addresses = await lookup(url.hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((value) => !publicAddress(value.address))
  )
    throw new Error("Job URL must resolve to a public website.");
  const address = addresses.find((entry) => entry.family === 4) ?? addresses[0];
  return new Promise<Resource>((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        family: address.family,
        timeout: 10000,
        lookup: (_hostname, _options, callback) =>
          callback(null, address.address, address.family),
        headers: {
          Accept: "text/html",
          "Accept-Encoding": "identity",
          "User-Agent":
            browserHeaders["user-agent"] || "JobApplicationMetadata/1.0",
          ...Object.fromEntries(
            Object.entries(browserHeaders).filter(([key]) =>
              [
                "accept",
                "accept-language",
                "cookie",
                "x-calypso-csrf-token",
                "x-workday-tenant",
              ].includes(key),
            ),
          ),
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (remainingRedirects <= 0)
            return reject(new Error("Too many redirects."));
          let next: URL;
          try {
            next = jobUrl(new URL(res.headers.location, url).href);
          } catch {
            return reject(
              new Error("Job URL redirects to an unsafe destination."),
            );
          }
          void readResource(next, remainingRedirects - 1).then(resolve, reject);
          return;
        }
        if (status !== 200) {
          res.resume();
          reject(new Error("The job posting resource could not be read."));
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 8 * 1024 * 1024) {
            req.destroy(new Error("Job posting resource exceeds 8 MB."));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            body: Buffer.concat(chunks),
            contentType: String(
              res.headers["content-type"] ?? "application/octet-stream",
            ),
            cookies: res.headers["set-cookie"] ?? [],
          }),
        );
        res.on("error", reject);
      },
    );
    req.on("timeout", () =>
      req.destroy(new Error("Job posting request timed out.")),
    );
    req.on("error", reject);
    req.end();
  });
}

/** Read an anonymous rendered DOM; every request stays behind the public-address guard. */
async function renderedPosting(url: URL): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      serviceWorkers: "block",
      acceptDownloads: false,
    });
    await context.route("**/*", async (route) => {
      const request = route.request();
      if (
        request.method() !== "GET" ||
        ["image", "media", "font"].includes(request.resourceType())
      )
        return route.abort();
      try {
        const resource = await readResource(
          jobUrl(request.url()),
          2,
          await request.allHeaders(),
        );
        await route.fulfill({
          status: 200,
          contentType: resource.contentType,
          body: resource.body,
          headers: {
            "access-control-allow-origin": url.origin,
            "access-control-allow-credentials": "true",
            ...(resource.cookies.length
              ? { "set-cookie": resource.cookies.join("\n") }
              : {}),
          },
        });
      } catch {
        await route.abort().catch(() => {});
      }
    });
    const page = await context.newPage();
    await page.goto(url.href, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (url.hostname.endsWith(".myworkdayjobs.com")) {
      await page
        .locator('[data-automation-id="jobPostingDescription"]')
        .waitFor({ state: "attached", timeout: 20000 });
    }
    return await page.content();
  } finally {
    await browser.close();
  }
}

const text = (value: unknown, limit = 500): string =>
  typeof value === "string"
    ? load(value, null, false)
        .text()
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit)
    : "";

const htmlToMarkdown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

function descriptionMarkdown(value: string): string {
  const $ = load(value, null, false);
  $("script,style,noscript,iframe,object,form").remove();
  $("a").each((_index, element) => {
    const link = $(element);
    const href = link.attr("href") ?? "";
    if (!/^(?:https?:|mailto:|\/|#)/i.test(href)) link.removeAttr("href");
  });
  return htmlToMarkdown.turndown($.html()).trim().slice(0, 30000);
}

/** Resolve a Workday activation/apply link to its public posting without using the activation token. */
export function postingUrl(raw: string): URL {
  let url = jobUrl(raw);
  if (url.hostname.endsWith(".myworkdayjobs.com")) {
    const redirect = url.searchParams.get("redirect");
    if (redirect) {
      const destination = jobUrl(new URL(redirect, url).href);
      if (
        destination.origin !== url.origin ||
        !destination.pathname.includes("/job/")
      )
        throw new Error(
          "The application link must point to a job on the same employer website.",
        );
      url = destination;
    }
    url.pathname = url.pathname.replace(/\/apply(?:\/.*)?$/, "");
    url.search = "";
  }
  return url;
}

function findPosting(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) return value.map(findPosting).find(Boolean);
  const node = value as Record<string, unknown>;
  const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
  if (
    types.some(
      (type) => typeof type === "string" && /(?:^|\/)JobPosting$/i.test(type),
    )
  )
    return node;
  return findPosting(node["@graph"]);
}

function salaryText(
  posting: Record<string, unknown> | undefined,
  description: string,
): string {
  const raw = posting?.baseSalary ?? posting?.estimatedSalary;
  const salary = (Array.isArray(raw) ? raw[0] : raw) as
    Record<string, unknown> | undefined;
  if (salary && typeof salary === "object") {
    const value = salary.value;
    const currency = text(salary.currency, 10);
    if (typeof value === "number")
      return [currency, value.toLocaleString("en-US")]
        .filter(Boolean)
        .join(" ");
    if (value && typeof value === "object") {
      const quantity = value as Record<string, unknown>;
      const amount = (number: unknown) =>
        typeof number === "number" && Number.isFinite(number)
          ? number.toLocaleString("en-US")
          : "";
      const range =
        quantity.minValue != null || quantity.maxValue != null
          ? [amount(quantity.minValue), amount(quantity.maxValue)]
              .filter(Boolean)
              .join(" – ")
          : amount(quantity.value);
      if (range)
        return [
          currency,
          range,
          text(quantity.unitText, 30)
            ? "per " + text(quantity.unitText, 30).toLowerCase()
            : "",
        ]
          .filter(Boolean)
          .join(" ");
    }
  }
  const lines = description
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = 0; index < lines.length; index++) {
    if (
      !/salary|base pay|pay range|hourly rate|compensation range/i.test(
        lines[index],
      )
    )
      continue;
    const context = lines.slice(index, index + 2).join(" ");
    const match = context.match(
      /(?:US\$|USD\s*|CAD\s*|\$|£|€)\s*[\d,]+(?:\.\d{1,2})?(?:\s*(?:USD|CAD|GBP|EUR))?(?:\s*[-–—]\s*(?:US\$|USD\s*|CAD\s*|\$|£|€)?\s*[\d,]+(?:\.\d{1,2})?(?:\s*(?:USD|CAD|GBP|EUR))?)?(?:\s*(?:per|\/)\s*(?:year|hour|month|annum)|\s*(?:annually|hourly))?/i,
    );
    if (match) return match[0].trim().slice(0, 500);
  }
  return "";
}

export function parseJobMetadata(html: string): JobMetadata {
  const $ = load(html);
  let posting: Record<string, unknown> | undefined;
  for (const element of $("script[type='application/ld+json']").toArray()) {
    try {
      posting = findPosting(JSON.parse($(element).text()));
    } catch {
      continue;
    }
    if (posting) break;
  }
  const meta = (key: string) =>
    $("meta")
      .toArray()
      .map((element) => $(element))
      .find(
        (element) =>
          (element.attr("property") || element.attr("name"))?.toLowerCase() ===
          key,
      )
      ?.attr("content") ?? "";
  const pageTitle = text(
    meta("og:title") || meta("twitter:title") || $("title").text(),
  );
  const titleParts = pageTitle.split(/\s+(?:\||–|—|-)\s+/);
  const organization = posting?.hiringOrganization as
    { name?: unknown } | undefined;
  const role =
    text(posting?.title) ||
    text(
      $("[data-automation-id='jobPostingHeader'],[itemprop='title'],main h1")
        .first()
        .text(),
    ) ||
    (titleParts[0] ?? "")
      .replace(/\s+(?:Jobs?|Careers?|Apply Now)$/i, "")
      .trim();
  const generic =
    /^(workday|linkedin|indeed|greenhouse|lever|jobs?|careers?)$/i;
  const site = text(meta("og:site_name"));
  const titleCompany = (titleParts[1] ?? "")
    .replace(/\s+(?:Jobs?|Careers?)$/i, "")
    .trim();
  const company =
    text(organization?.name) ||
    text(
      $("[itemprop='hiringOrganization'],[data-automation-id='companyName']")
        .first()
        .text(),
    ) ||
    (site && !generic.test(site)
      ? site
      : titleCompany && !generic.test(titleCompany)
        ? titleCompany
        : "");
  const locationRecord = (
    Array.isArray(posting?.jobLocation)
      ? posting?.jobLocation[0]
      : posting?.jobLocation
  ) as { address?: Record<string, unknown> } | undefined;
  const address = locationRecord?.address;
  const location = address
    ? [address.addressLocality, address.addressRegion]
        .map((value) => text(value))
        .filter(Boolean)
        .join(", ")
    : text(
        $("[data-automation-id='locations'],[itemprop='jobLocation']")
          .first()
          .text(),
      );
  const identifier = posting?.identifier as { value?: unknown } | undefined;
  const requisitionId =
    text(identifier?.value) ||
    text($("[data-automation-id='jobReqId']").first().text());
  const employmentType = text(
    Array.isArray(posting?.employmentType)
      ? posting.employmentType.join(", ")
      : posting?.employmentType,
  );
  const descriptionHtml = $(
    "[data-automation-id='jobPostingDescription'],[itemprop='description']",
  )
    .first()
    .html();
  const description = descriptionMarkdown(
    descriptionHtml ??
      (typeof posting?.description === "string" ? posting.description : ""),
  );
  const salary = salaryText(posting, description);
  const canonicalUrl = $("link[rel='canonical']").attr("href") ?? "";
  const details = Object.fromEntries(
    Object.entries({
      location,
      requisitionId,
      employmentType,
      description,
      salary,
      ...(canonicalUrl ? { postingUrl: canonicalUrl } : {}),
    }).filter(([, value]) => value),
  );
  return {
    role: role.slice(0, 500),
    company: company.slice(0, 500),
    ...(Object.keys(details).length ? { details } : {}),
  };
}

export async function lookupJobMetadata(raw: unknown): Promise<JobMetadata> {
  if (typeof raw !== "string" || raw.length > 4000)
    throw new Error("A job posting URL is required.");
  const url = postingUrl(raw);
  const metadata = parseJobMetadata(await renderedPosting(url));
  let canonical = url;
  if (metadata.details?.postingUrl) {
    try {
      const candidate = jobUrl(new URL(metadata.details.postingUrl, url).href);
      if (
        candidate.origin === url.origin &&
        candidate.pathname.includes("/job/")
      )
        canonical = candidate;
    } catch {
      /* Retain the validated posting address. */
    }
  }
  return {
    ...metadata,
    details: { ...metadata.details, postingUrl: canonical.href },
  };
}
