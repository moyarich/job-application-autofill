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
import { Bold, Italic, List, Undo2, Redo2 } from "lucide-react";
import {
  markdownToEditor,
  editorToMarkdown,
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
  const bullet =
    !!editor.selection &&
    Array.from(
      Editor.nodes(editor, {
        match: (node) => Element.isElement(node) && node.type === "bullet",
      }),
    ).length > 0;
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
        onClick={() =>
          Transforms.setNodes(
            editor,
            { type: bullet ? "paragraph" : "bullet" },
            {
              match: (node) =>
                Element.isElement(node) && Editor.isBlock(editor, node),
            },
          )
        }
      >
        <List size={16} />
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
                    : "rich-text-paragraph"
                }
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
