import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  CheckCircle2,
  ChevronDown,
  CircleArrowRight,
  CircleMinus,
  GripVertical,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import type { MenuItem } from "./api";
import { useEmployerMenu } from "./useEmployerMenu";
export type SiteMenuHandle = { refresh: () => void; toggle: () => void };

function ItemStatus({ item, current }: { item: MenuItem; current: boolean }) {
  const Icon = current
    ? LoaderCircle
    : ["processed", "filled"].includes(item.status ?? "")
      ? CheckCircle2
      : item.status === "needs_review"
        ? TriangleAlert
        : item.available
          ? CircleArrowRight
          : CircleMinus;
  const label = current
    ? "Running"
    : item.status === "processed"
      ? "Processed"
      : item.status === "filled"
        ? "Filled"
        : item.status === "needs_review"
          ? "Needs review"
          : item.status === "ready" && !item.available
            ? "Manual entry"
            : item.available
              ? "Ready"
              : "Not on this page";
  return (
    <small id={"step-status-" + encodeURIComponent(item.id)}>
      <Icon
        aria-hidden="true"
        className={"step-status-icon" + (current ? " running" : "")}
      />
      {label}
    </small>
  );
}

export const SiteMenu = forwardRef<
  SiteMenuHandle,
  { session: string; profile: string; connected: boolean; onClosed: () => void }
>(function SiteMenu({ session, profile, connected, onClosed }, ref) {
  const menu = useEmployerMenu(session, profile, connected, onClosed);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const element = useRef<HTMLElement>(null),
    handle = useRef<HTMLButtonElement>(null);
  const moved = useRef(false),
    suppressClick = useRef(false);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
    moved: boolean;
  } | null>(null);
  const toggle = useCallback(() => setOpen((value) => !value), []);
  useImperativeHandle(
    ref,
    () => ({
      toggle,
      refresh: () => {
        void menu.refresh();
      },
    }),
    [toggle, menu.refresh],
  );
  useEffect(() => {
    if (open) void menu.refresh();
  }, [open, menu.refresh]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        handle.current?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    const fit = () => {
      const rect = node.getBoundingClientRect();
      const desiredLeft = moved.current
        ? rect.left
        : innerWidth - rect.width - 16;
      const desiredTop = moved.current ? rect.top : innerWidth <= 600 ? 52 : 16;
      const next = {
        left: Math.max(8, Math.min(desiredLeft, innerWidth - rect.width - 8)),
        top: Math.max(8, Math.min(desiredTop, innerHeight - rect.height - 8)),
      };
      setPosition((old) =>
        old?.left === next.left && old.top === next.top ? old : next,
      );
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [Boolean(menu.active), open]);
  function dragStart(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    const rect = element.current!.getBoundingClientRect();
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function dragMove(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current,
      node = element.current;
    if (!start || !node) return;
    const dx = event.clientX - start.x,
      dy = event.clientY - start.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) start.moved = true;
    if (!start.moved) return;
    moved.current = true;
    setPosition({
      left: Math.max(
        8,
        Math.min(start.left + dx, innerWidth - node.offsetWidth - 8),
      ),
      top: Math.max(
        8,
        Math.min(start.top + dy, innerHeight - node.offsetHeight - 8),
      ),
    });
  }
  const active = menu.active;
  if (!active) return null;
  const running = Boolean(
    active.running || active.state === "preparing" || menu.busy,
  );
  const finished = ["submitted", "submission_unverified"].includes(
    active.state,
  );
  const state = active.paused
    ? "Paused — browser remains available"
    : active.state === "submitted"
      ? "Submission confirmed"
      : active.state === "submission_unverified"
        ? "Submission not confirmed"
        : running
          ? active.currentAction
            ? "Running — " + active.currentAction
            : "Running"
          : active.state === "ready_for_review"
            ? "Ready for review"
            : active.state === "login_required"
              ? "Sign-in required"
              : "Needs attention";
  const handled = menu.items.filter((item) =>
    ["filled", "processed"].includes(item.status ?? ""),
  ).length;
  const reviews = menu.items.filter((item) => item.status === "needs_review");
  const ready = menu.items.filter(
    (item) => item.available && (!item.status || item.status === "ready"),
  );
  const manual = menu.items.find(
    (item) => !item.available && item.status === "ready",
  );
  const review = reviews.find((item) => item.available) ?? reviews[0];
  const summary = [
    handled ? `${handled} done` : "",
    reviews.length ? `${reviews.length} to check` : "",
    ready.length ? `${ready.length} ready` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const next = active.paused
    ? "Paused"
    : running
      ? `Filling ${active.currentAction || "this page"}…`
      : active.state === "login_required"
        ? "Sign in to continue"
        : active.state === "manual_intervention"
          ? "Complete verification"
          : active.state === "submitted"
            ? "Application submitted"
            : active.state === "submission_unverified"
              ? "Check submission on employer site"
              : review
                ? `Check ${review.label}`
                : ready.length
                  ? `Fill ${ready[0].label}`
                  : manual
                    ? `Enter ${manual.label}`
                    : "Review, then Save and Continue on employer site";
  return (
    <nav
      id="site-menu"
      ref={element}
      className={"visible" + (open ? " expanded" : "")}
      aria-label="Employer actions"
      style={position ?? undefined}
    >
      <button
        id="menu-handle"
        ref={handle}
        type="button"
        aria-expanded={open}
        title={state + " — drag to move, click to expand"}
        onPointerDown={dragStart}
        onPointerMove={dragMove}
        onPointerUp={() => {
          suppressClick.current = Boolean(drag.current?.moved);
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          toggle();
        }}
      >
        <GripVertical aria-hidden="true" />
        <span>Employer actions</span>
        <ChevronDown aria-hidden="true" className="menu-chevron" />
      </button>
      <div
        id="automation-state"
        role="status"
        data-phase={
          active.paused ? "paused" : running ? "running" : active.state
        }
      >
        {state}
      </div>
      <div id="automation-actions">
        {finished ? (
          <button type="button" onClick={() => void menu.run("close")}>
            Close
          </button>
        ) : (
          <>
            {!running &&
            (active.paused ||
              [
                "manual_intervention",
                "login_required",
                "ready_for_review",
              ].includes(active.state)) ? (
              <button
                type="button"
                className="primary"
                title="Fill this page without advancing to the next employer step"
                onClick={() => void menu.run("continue")}
              >
                Resume autofill
              </button>
            ) : (
              <button type="button" onClick={() => void menu.run("pause")}>
                Pause
              </button>
            )}
            <button
              type="button"
              className="danger"
              onClick={() => void menu.run("close")}
            >
              Stop
            </button>
          </>
        )}
      </div>
      <div id="menu-list">
        {!active.paused &&
          !finished &&
          menu.items.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-describedby={"step-status-" + encodeURIComponent(item.id)}
              data-status={item.status ?? ""}
              data-active={running && active.currentAction === item.label}
              disabled={!item.available || running}
              onClick={() => void menu.run("menu", item.id)}
            >
              <span>{item.label}</span>
              <ItemStatus
                item={item}
                current={running && active.currentAction === item.label}
              />
            </button>
          ))}
      </div>
      <footer id="menu-footer">
        <div className="menu-footer-summary">
          <span id="menu-summary">{summary}</span>
          <button
            id="menu-refresh"
            type="button"
            aria-label="Refresh section status"
            aria-busy={menu.refreshing}
            title={
              menu.refreshing
                ? "Refreshing section status…"
                : "Refresh section status"
            }
            onClick={() => void menu.refresh()}
          >
            <RefreshCw
              size={14}
              className={menu.refreshing ? "running" : undefined}
            />
          </button>
        </div>
        <p id="menu-next-step">{next}</p>
        <div id="menu-message" role="status">
          {menu.error}
        </div>
      </footer>
    </nav>
  );
});
