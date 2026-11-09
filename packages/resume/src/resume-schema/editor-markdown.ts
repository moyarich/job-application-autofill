import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import type { Root, PhrasingContent, List } from "mdast";
import type { RichTextLeaf } from "./markdown.ts";

const processor = unified().use(remarkParse).use(remarkStringify);

/** Let mdast, not inline Markdown token flags, own nested formatting. */
export function parseInlineMarkdown(source: string): RichTextLeaf[] {
  const parsed = processor.parse(source);
  const first = parsed.children[0];
  if (first?.type !== "paragraph" && first?.type !== "heading") {
    return [{ text: source }];
  }
  const leaves: RichTextLeaf[] = [];
  function visit(nodes: PhrasingContent[], marks: Omit<RichTextLeaf, "text"> = {}) {
    for (const node of nodes) {
      switch (node.type) {
        case "text":
          leaves.push({ text: node.value, ...marks });
          break;
        case "inlineCode":
          leaves.push({ text: node.value, ...marks, code: true });
          break;
        case "strong":
          visit(node.children, { ...marks, bold: true });
          break;
        case "emphasis":
          visit(node.children, { ...marks, italic: true });
          break;
        case "link":
          visit(node.children, { ...marks, href: node.url });
          break;
        case "image":
          leaves.push({ text: node.alt || "", ...marks });
          break;
        case "break":
          leaves.push({ text: "\n", ...marks });
          break;
        default:
          // Keep unfamiliar inline nodes as readable text, not editor markup.
          if ("value" in node && typeof node.value === "string") {
            leaves.push({ text: node.value, ...marks });
          }
      }
    }
  }
  visit(first.children);
  return leaves.length ? leaves : [{ text: "" }];
}

/** Serialize Slate leaves with remark's CommonMark escaping rules. */
export function stringifyInlineMarkdown(leaves: RichTextLeaf[]): string {
  const children: PhrasingContent[] = leaves.map((leaf) => {
    let node: PhrasingContent = leaf.code
      ? { type: "inlineCode", value: leaf.text }
      : { type: "text", value: leaf.text };
    if (leaf.italic) node = { type: "emphasis", children: [node] };
    if (leaf.bold) node = { type: "strong", children: [node] };
    if (leaf.href) node = { type: "link", url: leaf.href, children: [node] };
    return node;
  });
  const root: Root = { type: "root", children: [{ type: "paragraph", children }] };
  return processor.stringify(root).replace(/\n$/, "");
}

/** Derive list nesting from the actual mdast tree, not indentation guesses. */
export function markdownListLevels(markdown: string, lineCount: number): number[] {
  const levels = Array<number>(lineCount).fill(0);
  const root = processor.parse(markdown);
  function walk(list: List, depth: number) {
    for (const item of list.children) {
      if (item.position) levels[item.position.start.line - 1] = depth;
      for (const child of item.children) {
        if (child.type === "list") walk(child, depth + 1);
      }
    }
  }
  for (const child of root.children) if (child.type === "list") walk(child, 0);
  return levels;
}
