import MarkdownIt from "markdown-it";
const markdown = new MarkdownIt({ html: false, linkify: false, breaks: true });
// Markdown markers retain the visual style selected in the resume editor.
markdown.renderer.rules.list_item_open = (
  tokens,
  index,
  options,
  _env,
  renderer,
) => {
  const marker = tokens[index].markup;
  if (marker === "*" || marker === "+") {
    tokens[index].attrSet(
      "style",
      `list-style-type: ${marker === "*" ? "circle" : "square"}`,
    );
  }
  return renderer.renderToken(tokens, index, options);
};

/** Render only safe Markdown; raw HTML stays visible text and unsafe links are rejected. */
export const sourceLists = (text: string) =>
  text.replace(
    /^([ \t]*)([•●▪◦‣⁃])\s*/gm,
    (_match, indent: string, marker: string) =>
      indent + (marker === "◦" ? "*" : marker === "▪" ? "+" : "-") + " ",
  );
export const markdownToHtml = (text: string) =>
  markdown.render(sourceLists(text));
export function markdownToPlainText(text: string): string {
  return markdown
    .parse(text, {})
    .map((token) => {
      if (token.type === "inline")
        return (token.children || [])
          .map((child) => {
            if (child.type === "softbreak" || child.type === "hardbreak")
              return "\n";
            if (child.type === "image") return child.content;
            return ["text", "code_inline"].includes(child.type)
              ? child.content
              : "";
          })
          .join("");
      if (token.type === "fence" || token.type === "code_block")
        return token.content;
      return ["paragraph_close", "heading_close", "tr_close"].includes(
        token.type,
      )
        ? "\n"
        : "";
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
