import { describe, expect, it } from "vitest";
import { parseJobMetadata } from "../../packages/resume-api/src/services/job-metadata.ts";

describe("job posting details", () => {
  it("reads title and hiring employer from schema.org JobPosting JSON-LD", () => {
    const html = `<html><head><script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Cloud Engineer",
       "hiringOrganization":{"@type":"Organization","name":"Example &amp; Co"}}
      </script></head></html>`;
    expect(parseJobMetadata(html)).toEqual({
      role: "Cloud Engineer", company: "Example & Co",
    });
  });

  it("uses page title and site metadata when JSON-LD is unavailable", () => {
    const html = `<meta property="og:title" content="Platform Engineer | Jobs">
      <meta property="og:site_name" content="Sample Labs">`;
    expect(parseJobMetadata(html)).toEqual({
      role: "Platform Engineer", company: "Sample Labs",
    });
  });

  it("returns editable empty values when the posting lacks metadata", () => {
    expect(parseJobMetadata("<html><body>Sign in</body></html>")).toEqual({
      role: "", company: "",
    });
  });
});
