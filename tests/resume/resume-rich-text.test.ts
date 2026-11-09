import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderResumeHtml } from "../../packages/resume/src/resume-schema/create-pdf.ts";
import {
  markdownToPlainText,
  markdownToHtml,
  markdownToEditor,
  editorToMarkdown,
  listDepth,
  setListStyle,
  shiftListIndent,
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

it("preserves nesting and list kinds through Markdown editing", () => {
  const input = [
    "- Projects",
    "    1. Design",
    "        - Research",
    "        - Prototyping",
    "    2. Delivery",
    "- Operations",
  ].join("\n");
  const blocks = markdownToEditor(input);
  expect(blocks.map((block) => block.type)).toEqual([
    "bullet", "numbered", "bullet", "bullet", "numbered", "bullet",
  ]);
  expect(blocks.map(listDepth)).toEqual([0, 4, 8, 8, 4, 0]);
  expect(editorToMarkdown(blocks)).toBe(input);
  expect(markdownToHtml(input)).toMatch(/<ol>[\s\S]*<ul>/);
});

it("supports indent, outdent, and changing bullet or numbered styles", () => {
  const [root] = markdownToEditor("- First");
  const nested = { ...root, ...shiftListIndent(root, 1) };
  expect(editorToMarkdown([nested])).toBe("    - First");
  const numbered = { ...nested, ...setListStyle(nested, "numbered") };
  expect(editorToMarkdown([numbered])).toBe("    1. First");
  const outdented = { ...numbered, ...shiftListIndent(numbered, -1) };
  expect(editorToMarkdown([outdented])).toBe("1. First");
  expect(editorToMarkdown([{ ...outdented, ...setListStyle(outdented, "paragraph") }]))
    .toBe("First");
});
