import { describe, expect, it } from "vitest";

import { renderResumeHtml } from "../../packages/resume/src/create-resume/create-pdf.ts";

describe("Unicode resume PDF export", () => {
  it("rejects malformed structured input", () => {
    expect(() => renderResumeHtml({ firstName: "Ada" })).toThrow();
  });
});
