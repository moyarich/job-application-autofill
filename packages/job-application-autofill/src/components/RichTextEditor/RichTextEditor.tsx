import { useEffect, useState } from "react";
import {
  createEditor,
  Editor,
  Element,
  Transforms,
  type BaseEditor,
} from "slate";
import {
  Editable,
  Slate,
  useSlate,
  withReact,
  type ReactEditor,
} from "slate-react";
import { withHistory, type HistoryEditor } from "slate-history";
import { Bold, Italic, List, ListOrdered, IndentIncrease, IndentDecrease, Undo2, Redo2 } from "lucide-react";
import {
  markdownToEditor,
  editorToMarkdown,
  listDepth,
  setListStyle,
  shiftListIndent,
  type RichTextBlock,
  type RichTextLeaf,
  type RichTextDocument,
} from "@moyarich/resume/validate";
import "./RichTextEditor.css";

declare module "slate" {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor;
    Element: RichTextBlock;
    Text: RichTextLeaf;
  }
}

function Toolbar({ label }: { label: string }) {
  const editor = useSlate();
  const marks = Editor.marks(editor);
  const toggle = (mark: "bold" | "italic") =>
    marks?.[mark]
      ? Editor.removeMark(editor, mark)
      : Editor.addMark(editor, mark, true);
  const selectedBlocks = () => Array.from(Editor.nodes(editor, {
    at: editor.selection ?? undefined,
    match: (node) => Element.isElement(node) && Editor.isBlock(editor, node),
    mode: "lowest",
  })) as Array<[RichTextBlock, number[]]>;
  const selected = editor.selection ? selectedBlocks() : [];
  const bullet = selected.some(([block]) => block.type === "bullet");
  const numbered = selected.some(([block]) => block.type === "numbered");
  const listSelected = selected.some(([block]) => block.type !== "paragraph");
  const canOutdent = selected.some(([block]) => block.type !== "paragraph" && listDepth(block) > 0);
  const toggleList = (type: "bullet" | "numbered") => {
    const reset = selected.every(([block]) => block.type === type);
    for (const [block, path] of selectedBlocks())
      Transforms.setNodes(editor, setListStyle(block, reset ? "paragraph" : type), { at: path });
  };
  const indent = (direction: 1 | -1) => {
    for (const [block, path] of selectedBlocks()) {
      if (block.type !== "paragraph")
        Transforms.setNodes(editor, shiftListIndent(block, direction), { at: path });
    }
  };
  return (
    <div
      className="rich-text-toolbar"
      role="toolbar"
      aria-label={label + " formatting"}
    >
      <button
        type="button"
        aria-label="Bold"
        aria-pressed={!!marks?.bold}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => toggle("bold")}
      >
        <Bold size={15} />
      </button>
      <button
        type="button"
        aria-label="Italic"
        aria-pressed={!!marks?.italic}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => toggle("italic")}
      >
        <Italic size={15} />
      </button>
      <span className="rich-text-separator" />
      <button
        type="button"
        aria-label="Bullet list"
        aria-pressed={bullet}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => toggleList("bullet")}
      >
        <List size={16} />
      </button>
      <button
        type="button"
        aria-label="Numbered list"
        aria-pressed={numbered}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => toggleList("numbered")}
      >
        <ListOrdered size={16} />
      </button>
      <button
        type="button"
        aria-label="Decrease list indent"
        disabled={!canOutdent}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => indent(-1)}
      >
        <IndentDecrease size={16} />
      </button>
      <button
        type="button"
        aria-label="Increase list indent"
        disabled={!listSelected}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => indent(1)}
      >
        <IndentIncrease size={16} />
      </button>
      <span className="rich-text-separator" />
      <button
        type="button"
        aria-label="Undo"
        disabled={!editor.history.undos.length}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.undo()}
      >
        <Undo2 size={15} />
      </button>
      <button
        type="button"
        aria-label="Redo"
        disabled={!editor.history.redos.length}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.redo()}
      >
        <Redo2 size={15} />
      </button>
    </div>
  );
}
export function RichTextEditor({
  value,
  label,
  onChange,
  bullets = false,
  placeholder,
}: {
  value: string;
  label: string;
  onChange: (text: string) => void;
  bullets?: boolean;
  placeholder?: string;
}) {
  const [sourceMode, setSourceMode] = useState(false);
  const [editor] = useState(() => withHistory(withReact(createEditor())));
  const initial = markdownToEditor(value, bullets);
  useEffect(() => {
    if (editorToMarkdown(editor.children as RichTextDocument) === value) return;
    editor.children = structuredClone(initial);
    editor.selection = null;
    editor.history = { undos: [], redos: [] };
    editor.onChange();
  }, [value, editor]);
  return (
    <div className="rich-text-editor">
      <Slate
        editor={editor}
        initialValue={structuredClone(initial)}
        onChange={(nodes) => {
          if (
            !editor.operations.some(
              (operation) => operation.type !== "set_selection",
            )
          )
            return;
          const document = structuredClone(nodes) as RichTextDocument;
          onChange(editorToMarkdown(document));
        }}
      >
        <div className="rich-text-controls">
          {!sourceMode && <Toolbar label={label} />}
          <button
            type="button"
            className="rich-text-source-toggle"
            aria-pressed={sourceMode}
            onClick={() => setSourceMode((value) => !value)}
          >
            {sourceMode ? "Rich text" : "Markdown"}
          </button>
        </div>
        {sourceMode ? (
          <textarea
            className="rich-text-source"
            aria-label={label + " Markdown"}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={6}
          />
        ) : (
          <Editable
            aria-label={label}
            role="textbox"
            aria-multiline
            placeholder={placeholder}
            className="rich-text-content"
            renderElement={({ attributes, children, element }) => (
              <div
                {...attributes}
                className={
                  element.type === "bullet"
                    ? "rich-text-bullet"
                    : element.type === "numbered"
                      ? "rich-text-numbered"
                      : "rich-text-paragraph"
                }
                data-marker={element.type === "numbered"
                  ? (element.prefix?.trim().match(/^\\d+[.)]/)?.[0] ?? "1.")
                  : undefined}
                style={element.type !== "paragraph"
                  ? { marginLeft: listDepth(element) * 4 }
                  : undefined}
              >
                {children}
              </div>
            )}
            renderLeaf={({ attributes, children, leaf }) => (
              <span {...attributes}>
                {leaf.bold ? (
                  <strong>
                    {leaf.italic ? <em>{children}</em> : children}
                  </strong>
                ) : leaf.italic ? (
                  <em>{children}</em>
                ) : (
                  children
                )}
              </span>
            )}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
                const current = Array.from(Editor.nodes(editor, {
                  match: (node) => Element.isElement(node) && Editor.isBlock(editor, node),
                  mode: "lowest",
                })) as Array<[RichTextBlock, number[]]>;
                const [entry] = current;
                if (entry && entry[0].type !== "paragraph") {
                  const [block] = entry;
                  event.preventDefault();
                  if (!Editor.string(editor, entry[1]).trim()) {
                    Transforms.setNodes(editor, setListStyle(block, "paragraph"), { at: entry[1] });
                  } else {
                    editor.insertBreak();
                    const next = Array.from(Editor.nodes(editor, {
                      match: (node) => Element.isElement(node) && Editor.isBlock(editor, node),
                      mode: "lowest",
                    })) as Array<[RichTextBlock, number[]]>;
                    const [newEntry] = next;
                    if (newEntry) {
                      const previousNumber = Number(block.prefix?.trim().match(/^(\\d+)[.)]/)?.[1] ?? 0);
                      const prefix = block.type === "numbered"
                        ? " ".repeat(listDepth(block)) + (previousNumber + 1) + ". "
                        : block.prefix ?? "- ";
                      Transforms.setNodes(editor, { type: block.type, prefix }, { at: newEntry[1] });
                    }
                  }
                  return;
                }
              }
              if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
                const blocks = Array.from(Editor.nodes(editor, {
                  match: (node) => Element.isElement(node) && Editor.isBlock(editor, node),
                  mode: "lowest",
                })) as Array<[RichTextBlock, number[]]>;
                if (blocks.some(([block]) => block.type !== "paragraph")) {
                  event.preventDefault();
                  for (const [block, path] of blocks)
                    if (block.type !== "paragraph")
                      Transforms.setNodes(editor, shiftListIndent(block, event.shiftKey ? -1 : 1), { at: path });
                  return;
                }
              }
              if (!(event.ctrlKey || event.metaKey)) return;
              const mark =
                event.key.toLowerCase() === "b"
                  ? "bold"
                  : event.key.toLowerCase() === "i"
                    ? "italic"
                    : null;
              if (mark) {
                event.preventDefault();
                if (Editor.marks(editor)?.[mark])
                  Editor.removeMark(editor, mark);
                else Editor.addMark(editor, mark, true);
              }
            }}
          />
        )}
      </Slate>
    </div>
  );
}
