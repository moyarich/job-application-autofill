import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Expand, Minimize2, ListChecks, Scan, ZoomIn } from "lucide-react";
import { routes } from "../../routes";

export type ApplicationBrowserHandle = {
  refreshMenu: () => void;
  toggleMenu: () => void;
  focus: () => void;
  fit: () => void;
};

export const ApplicationBrowser = forwardRef<
  ApplicationBrowserHandle,
  { sessionId: string; profileId: string }
>(function ApplicationBrowser({ sessionId, profileId }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [actualSize, setActualSize] = useState(false);
  const [error, setError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const sync = () =>
      setIsFullscreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const send = useCallback(
    (action: string) => {
      frame.current?.contentWindow?.postMessage(
        { type: "moya:viewer-command", sessionId, action },
        window.location.origin,
      );
    },
    [sessionId],
  );
  useImperativeHandle(
    ref,
    () => ({
      refreshMenu: () => send("refresh-menu"),
      toggleMenu: () => send("toggle-menu"),
      focus: () => {
        frame.current?.focus();
        send("focus");
      },
      fit: () => {
        setActualSize(false);
        send("fit");
      },
    }),
    [send],
  );
  async function fullscreen() {
    try {
      if (document.fullscreenElement === container.current)
        await document.exitFullscreen();
      else await container.current?.requestFullscreen();
      setError("");
    } catch {
      setError(
        "Full screen is unavailable here. Use Open in new window for a larger view.",
      );
    }
  }
  return (
    <div ref={container} className="application-browser">
      <div
        className="application-browser-tools"
        role="toolbar"
        aria-label="Application browser controls"
      >
        <button type="button" onClick={() => send("toggle-menu")}>
          <ListChecks size={15} /> Employer actions
        </button>
        <button
          type="button"
          aria-pressed={actualSize}
          onClick={() => {
            send(actualSize ? "fit" : "actual-size");
            setActualSize(!actualSize);
          }}
        >
          {actualSize ? <Scan size={15} /> : <ZoomIn size={15} />}
          {actualSize ? "Fit to view" : "Actual size"}
        </button>
        <button
          type="button"
          aria-pressed={isFullscreen}
          onClick={() => void fullscreen()}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Expand size={15} />}
          {isFullscreen ? "Exit full screen" : "Full screen"}
        </button>
      </div>
      {error && <p role="status">{error}</p>}
      {actualSize && (
        <p className="application-browser-hint">
          Drag the employer view to move around the form.
        </p>
      )}
      <iframe
        ref={frame}
        className="browser-viewer"
        title="Interactive Playwright application browser"
        src={`${routes.applicationViewer}?session=${encodeURIComponent(sessionId)}&profile=${encodeURIComponent(profileId)}`}
        allow="clipboard-read; clipboard-write; fullscreen"
        allowFullScreen
        referrerPolicy="no-referrer"
        onLoad={() => {
          send("refresh-menu");
          send(actualSize ? "actual-size" : "fit");
        }}
      />
    </div>
  );
});
