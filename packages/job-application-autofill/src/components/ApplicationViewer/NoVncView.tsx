import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  focusViewerBrowser,
  pasteViewerText,
  readViewerConfig,
} from "../../api/viewer";

interface RemoteFrame extends EventTarget {
  scaleViewport: boolean;
  resizeSession: boolean;
  clipViewport: boolean;
  dragViewport: boolean;
  viewOnly: boolean;
  focus(): void;
  disconnect(): void;
  sendKey(key: number, code?: string, down?: boolean): void;
}
export type NoVncHandle = {
  focus: () => Promise<void>;
  setFit: (fit: boolean) => void;
  disconnect: () => void;
};
export const NoVncView = forwardRef<
  NoVncHandle,
  {
    session: string;
    profile: string;
    onStatus: (text: string) => void;
    onConnected: (connected: boolean) => void;
  }
>(function NoVncView({ session, profile, onStatus, onConnected }, ref) {
  const screen = useRef<HTMLDivElement>(null);
  const paste = useRef<HTMLTextAreaElement>(null);
  const controls = useRef<NoVncHandle | null>(null);
  const fit = useRef(true);
  useImperativeHandle(
    ref,
    () => ({
      focus: async () => {
        await controls.current?.focus();
      },
      setFit: (value) => {
        fit.current = value;
        controls.current?.setFit(value);
      },
      disconnect: () => controls.current?.disconnect(),
    }),
    [],
  );
  useEffect(() => {
    const target = screen.current!,
      input = paste.current!;
    const controller = new AbortController();
    const signal = controller.signal;
    let disposed = false,
      connected = false,
      copyRequested = false;
    let rfb: RemoteFrame | undefined;
    let focusRequest: Promise<void> | null = null;
    const report = (text: string) => {
      if (!disposed) onStatus(text);
    };
    function focusKeyboard(force = false) {
      if (!rfb || !connected || document.hidden) return;
      if (force && document.activeElement === input) input.blur();
      rfb.viewOnly = false;
      if (document.activeElement !== input && typeof rfb.focus === "function")
        rfb.focus();
    }
    async function focusApplication() {
      if (!focusRequest)
        focusRequest = focusViewerBrowser(session, profile, signal)
          .then(() => {})
          .catch(() => {
            throw new Error("This application browser session has ended.");
          })
          .finally(() => {
            focusRequest = null;
          });
      await focusRequest;
      focusKeyboard();
    }
    function setFit(value: boolean) {
      if (!rfb) return;
      rfb.scaleViewport = value;
      rfb.clipViewport = !value;
      rfb.dragViewport = !value;
    }
    controls.current = {
      focus: focusApplication,
      setFit,
      disconnect: () => rfb?.disconnect(),
    };
    function controlKey(letter: string) {
      if (!rfb) return;
      rfb.sendKey(0xffeb, "MetaLeft", false);
      rfb.sendKey(0xffec, "MetaRight", false);
      rfb.sendKey(0xffe3, "ControlLeft", true);
      rfb.sendKey(letter.charCodeAt(0), "Key" + letter.toUpperCase());
      rfb.sendKey(0xffe3, "ControlLeft", false);
    }
    async function pasteText(text: string) {
      if (!connected)
        throw new Error("Connect to the application browser before pasting.");
      await focusApplication();
      for (const [key, code] of [
        [0xffeb, "MetaLeft"],
        [0xffec, "MetaRight"],
        [0xffe3, "ControlLeft"],
        [0xffe4, "ControlRight"],
      ] as const)
        rfb!.sendKey(key, code, false);
      await pasteViewerText(session, profile, text, signal);
      input.value = "";
      focusKeyboard(true);
      report("Connected to application browser");
    }
    document.addEventListener(
      "paste",
      (event) => {
        if (event.target !== input && !target.contains(event.target as Node))
          return;
        const text = event.clipboardData?.getData("text/plain");
        if (text === undefined) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        void pasteText(text).catch((error: Error) => {
          input.value = "";
          report(error.message);
        });
      },
      { capture: true, signal },
    );
    target.addEventListener(
      "keydown",
      (event) => {
        if (!(event.metaKey || event.ctrlKey) || !connected) return;
        const key = event.key.toLowerCase();
        if (event.metaKey && ["a", "x", "z", "y"].includes(key)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          controlKey(key);
          return;
        }
        if (key !== "v" && key !== "c") return;
        event.stopImmediatePropagation();
        if (key === "c") {
          event.preventDefault();
          copyRequested = true;
          controlKey("c");
        } else {
          input.value = "";
          input.focus({ preventScroll: true });
        }
      },
      { capture: true, signal },
    );
    target.addEventListener(
      "pointerdown",
      () => {
        focusKeyboard(true);
        void focusApplication().catch((e: Error) => report(e.message));
      },
      { signal },
    );
    window.addEventListener(
      "focus",
      () => {
        void focusApplication().catch((e: Error) => report(e.message));
      },
      { signal },
    );
    window.addEventListener(
      "blur",
      () => {
        if (rfb) rfb.viewOnly = true;
      },
      { signal },
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          if (rfb) rfb.viewOnly = true;
        } else void focusApplication().catch((e: Error) => report(e.message));
      },
      { signal },
    );
    window.addEventListener("pagehide", () => rfb?.disconnect(), { signal });
    void (async () => {
      if (!session)
        throw new Error("Open the browser from an application page.");
      const config = await readViewerConfig(profile, signal);
      const modulePath = "/vnc/core/rfb.js";
      const { default: RFB } = (await import(
        /* @vite-ignore */ modulePath
      )) as {
        default: new (
          target: HTMLElement,
          url: string,
          options: unknown,
        ) => RemoteFrame;
      };
      if (disposed) return;
      const socket = new URL("/vnc/websockify", location.href);
      socket.protocol = location.protocol === "https:" ? "wss:" : "ws:";
      rfb = new RFB(target, socket.href, {
        credentials: { password: config.password },
      });
      setFit(fit.current);
      rfb.resizeSession = false;
      rfb.addEventListener("connect", () => {
        if (disposed) return;
        connected = true;
        onConnected(true);
        report("Connected to application browser");
        void focusApplication().catch((e: Error) => report(e.message));
      });
      rfb.addEventListener("disconnect", () => {
        connected = false;
        if (!disposed) {
          onConnected(false);
          report("Browser disconnected. Reopen this viewer to reconnect.");
        }
      });
      rfb.addEventListener("clipboard", (event) => {
        if (!copyRequested) return;
        copyRequested = false;
        void navigator.clipboard
          .writeText((event as CustomEvent<{ text: string }>).detail.text)
          .catch(() =>
            report("Allow clipboard access for this page to copy text."),
          );
      });
      rfb.addEventListener("securityfailure", () =>
        report(
          "Browser authentication failed. Check WEB_VNC_PASSWORD and restart the app.",
        ),
      );
    })().catch((error: Error) => {
      if (!disposed)
        report(error.message || "Could not connect to application browser.");
    });
    return () => {
      disposed = true;
      controller.abort();
      controls.current = null;
      rfb?.disconnect();
    };
  }, [session, profile, onStatus, onConnected]);
  return (
    <>
      <div id="screen" ref={screen} />
      <textarea
        id="paste-input"
        ref={paste}
        tabIndex={-1}
        aria-label="Application paste input"
        autoComplete="off"
        spellCheck={false}
      />
    </>
  );
});
