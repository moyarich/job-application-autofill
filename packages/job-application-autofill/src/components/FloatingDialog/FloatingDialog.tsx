import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { GripHorizontal, X } from "lucide-react";
import { createPortal } from "react-dom";
import "./FloatingDialog.css";

export function FloatingDialog({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [position, setPosition] = useState({
    x: Math.max(12, (innerWidth - Math.min(760, innerWidth - 24)) / 2),
    y: Math.max(12, (innerHeight - Math.min(760, innerHeight - 48)) / 2),
  });
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  function move(x: number, y: number) {
    const rect = dialog.current?.getBoundingClientRect();
    setPosition({
      x: Math.max(0, Math.min(x, innerWidth - (rect?.width ?? 320))),
      y: Math.max(0, Math.min(y, innerHeight - (rect?.height ?? 200))),
    });
  }
  useEffect(() => {
    const node = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    node.showModal();
    const observer = new ResizeObserver(() => {
      const rect = node.getBoundingClientRect();
      move(rect.left, rect.top);
    });
    observer.observe(node);
    const resize = () => {
      const r = node.getBoundingClientRect();
      move(r.left, r.top);
    };
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      node.close();
      previous?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className="floating-dialog"
      aria-labelledby={titleId}
      style={{ left: position.x, top: position.y }}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
    >
      <header
        className="floating-dialog-header"
        onPointerDown={(event) => {
          if (
            event.button !== 0 ||
            (event.target instanceof Element && event.target.closest("button"))
          )
            return;
          event.preventDefault();
          const rect = dialog.current!.getBoundingClientRect();
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            left: rect.left,
            top: rect.top,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (start)
            move(
              start.left + event.clientX - start.x,
              start.top + event.clientY - start.y,
            );
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        <GripHorizontal
          size={18}
          aria-hidden="true"
          className="floating-dialog-grip"
        />
        <h2
          id={titleId}
          tabIndex={0}
          title="Drag the header to move. Arrow keys also move this dialog."
          onKeyDown={(event) => {
            const delta = {
              ArrowLeft: [-16, 0],
              ArrowRight: [16, 0],
              ArrowUp: [0, -16],
              ArrowDown: [0, 16],
            }[event.key];
            if (!delta) return;
            event.preventDefault();
            move(position.x + delta[0], position.y + delta[1]);
          }}
        >
          {title}
        </h2>
        <button
          type="button"
          className="secondary"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="floating-dialog-body">{children}</div>
      {footer && <footer className="floating-dialog-footer">{footer}</footer>}
    </dialog>,
    document.body,
  );
}
