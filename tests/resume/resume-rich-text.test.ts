import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderResumeHtml } from "../../packages/resume/src/resume-schema/create-pdf.ts";
import {
  markdownToPlainText,
  markdownToHtml,
  markdownToEditor,
  editorToMarkdown,
  resumeToPlainText,
} from "../../packages/resume/src/resume-schema/markdown.ts";
const example = JSON.parse(
  readFileSync("packages/resume/src/resume-schema/resume.example.json", "utf8"),
);
it("uses one Markdown string for rich editing, plain autofill and PDF rendering", () => {
  const p = structuredClone(example);
  p.summary = "Ships **secure** and *reliable* software";
  p.experience[0].description = "- **First achievement**\n- Second achievement";
  expect(editorToMarkdown(markdownToEditor(p.summary))).toBe(p.summary);
  const html = renderResumeHtml(p);
  expect(html).toContain("<strong>secure</strong>");
  expect(html).toContain("<em>reliable</em>");
  expect(html).toContain("<li><strong>First achievement</strong></li>");
  const plain = resumeToPlainText(p);
  expect(plain.summary).toBe("Ships secure and reliable software");
  expect(plain.experience[0].description).toBe(
    "First achievement\nSecond achievement",
  );
  expect(p.summary).toContain("**secure**");
});
it("escapes raw HTML and rejects unsafe Markdown links", () => {
  const html = markdownToHtml(
    "<script>alert(1)</script>\n[x](javascript:alert(1))",
  );
  expect(html).not.toContain("<script>");
  expect(html).not.toContain('href="javascript:');
  expect(
    markdownToPlainText(
      "## Heading\n\n[Portfolio](https://example.com) and `code`\n\n- Item",
    ),
  ).toBe("Heading\nPortfolio and code\nItem");
});
