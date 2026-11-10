import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { renderResumeHtml } from "../../packages/resume/src/resume-schema/create-pdf.ts";

const resume = JSON.parse(
  readFileSync(
    new URL(
      "../../packages/resume/src/resume-schema/resume.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

describe("PDF pagination", () => {
  it("allows long roles to flow across pages while keeping individual bullets together", () => {
    const html = renderResumeHtml(resume);
    expect(html).toContain(
      "article { margin-bottom: 9pt; break-inside: auto; }",
    );
    expect(html).toContain("overflow-wrap: anywhere; break-inside: avoid;");
    expect(html).toContain(".meta, .period { break-after: avoid; }");
  });
});
