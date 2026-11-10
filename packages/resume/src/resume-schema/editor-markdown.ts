import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import type { Root, PhrasingContent, List } from "mdast";
import { sourceLists } from "./markdown-render.ts";

export type RichTextLeaf = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  href?: string;
};
export type RichTextBlock = {
  type: "paragraph" | "bullet" | "numbered";
  prefix?: string;
  children: RichTextLeaf[];
};
export type RichTextDocument = RichTextBlock[];

const processor = unified().use(remarkParse).use(remarkStringify);

/** Let mdast, not inline Markdown token flags, own nested formatting. */
export function parseInlineMarkdown(source: string): RichTextLeaf[] {
  const parsed = processor.parse(source);
  const first = parsed.children[0];
  if (first?.type !== "paragraph" && first?.type !== "heading") {
    return [{ text: source }];
  }
  const leaves: RichTextLeaf[] = [];
  function visit(
    nodes: PhrasingContent[],
    marks: Omit<RichTextLeaf, "text"> = {},
  ) {
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
  const root: Root = {
    type: "root",
    children: [{ type: "paragraph", children }],
  };
  return processor.stringify(root).replace(/\n$/, "");
}

/** Derive list nesting from the actual mdast tree, not indentation guesses. */
export function markdownListLevels(
  markdown: string,
  lineCount: number,
): number[] {
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

/** A deliberately small resume editor vocabulary, serialized into the existing Markdown string. */
export function markdownToEditor(
  text: string,
  bullets = false,
): RichTextDocument {
  return sourceLists(text)
    .split("\n")
    .map((line) => {
      const prefix =
        line.match(/^(\s*(?:[-*+] |\d+[.)] |#{1,6} |> ))/)?.[0] || "";
      const numbered = /^\s*\d+[.)] /.test(prefix);
      const bullet = /^\s*[-*+] /.test(prefix);
      const children = parseInlineMarkdown(line.slice(prefix.length));
      return {
        type: numbered
          ? "numbered"
          : bullet || bullets
            ? "bullet"
            : "paragraph",
        prefix: prefix || (bullets ? "- " : ""),
        children: children.length ? children : [{ text: "" }],
      };
    });
}
/** Keep each list marker and its indentation in the Markdown representation. */
/** Resolve visual nesting from Markdown structure, including wide ordered markers. */
export function listNestingLevels(document: RichTextDocument): number[] {
  return markdownListLevels(editorToMarkdown(document), document.length);
}

export function listDepth(block: RichTextBlock): number {
  return block.prefix?.match(/^[ \t]*/)?.[0].replace(/\t/g, "    ").length ?? 0;
}

export function setListStyle(
  block: RichTextBlock,
  type: RichTextBlock["type"],
): Pick<RichTextBlock, "type" | "prefix"> {
  const indent = " ".repeat(listDepth(block));
  if (type === "paragraph") return { type, prefix: "" };
  const existing = block.prefix?.trim() ?? "";
  const marker =
    type === "numbered"
      ? /^\d+[.)]$/.test(existing)
        ? existing
        : "1."
      : /^[-*+]$/.test(existing)
        ? existing
        : "-";
  return { type, prefix: indent + marker + " " };
}

/** Four spaces per level keeps mixed and numbered sublists portable. */
export function shiftListIndent(
  block: RichTextBlock,
  direction: 1 | -1,
): Pick<RichTextBlock, "type" | "prefix"> {
  if (block.type === "paragraph")
    return { type: block.type, prefix: block.prefix ?? "" };
  const depth = Math.max(0, listDepth(block) + direction * 4);
  const marker =
    direction === 1 && block.type === "numbered"
      ? "1."
      : (block.prefix ?? "").trim() || (block.type === "numbered" ? "1." : "-");
  return { type: block.type, prefix: " ".repeat(depth) + marker + " " };
}

/**
 * Number contiguous ordered lists separately at each indentation level.
 * Nested lists do not interrupt numbering in their parent ordered list.
 * The first explicit number in each sequence remains the starting number.
 */
export function renumberListBlocks(
  document: RichTextDocument,
): RichTextDocument {
  const counters = new Map<number, number>();
  return document.map((block) => {
    if (block.type === "paragraph") {
      counters.clear();
      return block;
    }
    const depth = listDepth(block);
    for (const level of counters.keys()) {
      if (level > depth) counters.delete(level);
    }
    if (block.type === "bullet") {
      counters.delete(depth);
      return block;
    }
    const current = block.prefix?.trim() ?? "";
    const match = current.match(/^(\d+)([.)])$/);
    const next = counters.has(depth)
      ? counters.get(depth)! + 1
      : match
        ? Number(match[1])
        : 1;
    counters.set(depth, next);
    const prefix = " ".repeat(depth) + next + (match?.[2] ?? ".") + " ";
    return prefix === block.prefix ? block : { ...block, prefix };
  });
}

export function editorToMarkdown(document: RichTextDocument): string {
  return document
    .map((block) => {
      const contents = stringifyInlineMarkdown(block.children);
      return (
        (block.type === "bullet" || block.type === "numbered"
          ? /^\s*(?:[-*+] |\d+[.)] )/.test(block.prefix || "")
            ? block.prefix
            : block.type === "numbered"
              ? "1. "
              : "- "
          : block.prefix && !/^\s*(?:[-*+] |\d+[.)] )/.test(block.prefix)
            ? block.prefix
            : "") + contents
      );
    })
    .join("\n");
}
