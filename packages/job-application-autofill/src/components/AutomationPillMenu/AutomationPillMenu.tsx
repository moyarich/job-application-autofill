import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  ChevronDown,
  ClipboardList,
  FileUp,
  GraduationCap,
  ListChecks,
  LoaderCircle,
  LogIn,
  ScanSearch,
  Sparkles,
  UserPlus,
  UserRound,
} from "lucide-react";
import "./AutomationPillMenu.css";

export type AutomationActionId =
  | "detect"
  | "register"
  | "sign-in"
  | "contact"
  | "employment"
  | "education"
  | "resume"
  | "questions"
  | "next";

export type AutomationAction = {
  id: AutomationActionId;
  label: string;
  description: string;
  available: boolean;
  onSelect?: () => void | Promise<void>;
};

const items = [
  { id: "detect", label: "Detect current page", icon: ScanSearch },
  { id: "register", label: "Create account", icon: UserPlus },
  { id: "sign-in", label: "Sign in", icon: LogIn },
  { id: "contact", label: "Contact autofill", icon: UserRound },
  { id: "employment", label: "Employment autofill", icon: BriefcaseBusiness },
  { id: "education", label: "Education autofill", icon: GraduationCap },
  { id: "resume", label: "Upload resume", icon: FileUp },
  { id: "questions", label: "Screening questions", icon: ClipboardList },
  { id: "next", label: "Next step", icon: ArrowRight },
] as const;

export function AutomationPillMenu({
  actions,
  busy = false,
  status,
}: {
  actions: AutomationAction[];
  busy?: boolean;
  status?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState<AutomationActionId | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      )
        setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  async function activate(action: AutomationAction) {
    if (!action.available || !action.onSelect || busy || running) return;
    setRunning(action.id);
    setOpen(false);
    try {
      await action.onSelect();
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="automation-pill" ref={container}>
      {open && (
        <section
          className="automation-pill-popover"
          aria-label="Playwright automation actions"
        >
          <header className="automation-pill-header">
            <span className="automation-pill-mark">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <div>
              <strong>Playwright Automation</strong>
              <small>Choose an action for the current page</small>
            </div>
          </header>
          {status && (
            <div className="automation-pill-status" role="status">
              {status}
            </div>
          )}
          <div className="automation-pill-items">
            {items.map(({ id, label, icon: Icon }) => {
              const action = actions.find((entry) => entry.id === id);
              const enabled = Boolean(
                action?.available && action.onSelect && !busy && !running,
              );
              return (
                <button
                  key={id}
                  type="button"
                  className="automation-pill-item"
                  disabled={!enabled}
                  onClick={() => action && void activate(action)}
                  title={
                    !action?.available
                      ? "Not available for this session"
                      : undefined
                  }
                >
                  <span className="automation-pill-item-icon">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span className="automation-pill-item-text">
                    <strong>{action?.label ?? label}</strong>
                    <small>
                      {action?.description ??
                        "Requires a dedicated automation handler"}
                    </small>
                  </span>
                  {!action?.available && (
                    <span className="automation-pill-unavailable">
                      Unavailable
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <footer className="automation-pill-footnote">
            <ListChecks size={14} aria-hidden="true" /> Review fields before
            submitting. Automation never submits automatically.
          </footer>
        </section>
      )}
      <button
        ref={trigger}
        type="button"
        className="automation-pill-trigger"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Playwright Automation menu"
        onClick={() => setOpen((previous) => !previous)}
      >
        {busy || running ? (
          <LoaderCircle
            size={18}
            className="automation-pill-spin"
            aria-hidden="true"
          />
        ) : (
          <Sparkles size={19} aria-hidden="true" />
        )}
        <span>Playwright Automation</span>
        <ChevronDown
          size={16}
          className={
            open ? "automation-pill-chevron open" : "automation-pill-chevron"
          }
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
