import { describe, expect, it } from "vitest";
import { parseJobMetadata } from "../../packages/resume-api/src/services/job-metadata.ts";

describe("job posting details", () => {
  it("reads title and hiring employer from schema.org JobPosting JSON-LD", () => {
    const html = `<html><head><script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Cloud Engineer",
       "hiringOrganization":{"@type":"Organization","name":"Example &amp; Co"}}
      </script></head></html>`;
    expect(parseJobMetadata(html)).toEqual({
      role: "Cloud Engineer",
      company: "Example & Co",
    });
  });

  it("uses page title and site metadata when JSON-LD is unavailable", () => {
    const html = `<meta property="og:title" content="Platform Engineer | Jobs">
      <meta property="og:site_name" content="Sample Labs">`;
    expect(parseJobMetadata(html)).toEqual({
      role: "Platform Engineer",
      company: "Sample Labs",
    });
  });

  it("returns editable empty values when the posting lacks metadata", () => {
    expect(parseJobMetadata("<html><body>Sign in</body></html>")).toEqual({
      role: "",
      company: "",
    });
  });
});

it("extracts job facts and safe text through DOM parsing", () => {
  const html = `<link href="https://example.com/job/42" rel="canonical">
    <script type='application/ld+json'>{"@type":"JobPosting","title":"AI Developer","hiringOrganization":{"name":"Example"},"jobLocation":{"address":{"addressLocality":"Milpitas","addressRegion":"CA"}},"identifier":{"value":"JR42"},"employmentType":"FULL_TIME","description":"<p>Build <strong>tools</strong>.</p><script>unsafe()</script>"}</script>`;
  const result = parseJobMetadata(
    html.replace("unsafe()</script>", "unsafe()<\\/script>"),
  );
  expect(result.role).toBe("AI Developer");
  expect(result.details).toMatchObject({
    location: "Milpitas, CA",
    requisitionId: "JR42",
    employmentType: "FULL_TIME",
    postingUrl: "https://example.com/job/42",
  });
  expect(result.details?.description).toBe("Build **tools**.");
});

it("keeps an explicitly posted salary range with the description", () => {
  const result = parseJobMetadata(
    `<script type="application/ld+json">{"@type":"JobPosting","title":"Developer","hiringOrganization":{"name":"Example"},"description":"<p>Build developer tools.</p><p>Base salary: $160,000 – $190,000/year</p>"}</script>`,
  );
  expect(result.details?.salary).toBe("$160,000 – $190,000/year");
  expect(result.details?.description).toContain("Build developer tools.");
  expect(
    parseJobMetadata("<main><h1>Developer</h1></main>").details?.salary,
  ).toBeUndefined();
});
