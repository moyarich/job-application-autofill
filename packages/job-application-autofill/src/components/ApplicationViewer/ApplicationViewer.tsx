import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { NoVncView, type NoVncHandle } from "./NoVncView";
import { SiteMenu, type SiteMenuHandle } from "./SiteMenu";
import "./ApplicationViewer.css";

function ViewerSession({
  session,
  profile,
}: {
  session: string;
  profile: string;
}) {
  const remote = useRef<NoVncHandle>(null),
    menu = useRef<SiteMenuHandle>(null);
  const closed = useRef(false);
  const [status, setStatus] = useState(
    "Connecting to your application browser…",
  );
  const [connected, setConnected] = useState(false);
  const report = useCallback((text: string) => {
    if (!closed.current) setStatus(text);
  }, []);
  const onClosed = useCallback(() => {
    closed.current = true;
    remote.current?.disconnect();
    setConnected(false);
    setStatus("Application browser session closed");
  }, []);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== window.parent ||
        event.data?.type !== "moya:viewer-command" ||
        event.data.sessionId !== session ||
        closed.current
      )
        return;
      switch (event.data.action) {
        case "refresh-menu":
          menu.current?.refresh();
          break;
        case "toggle-menu":
          menu.current?.toggle();
          break;
        case "focus":
          void remote.current
            ?.focus()
            .catch((error: Error) => report(error.message));
          break;
        case "fit":
          remote.current?.setFit(true);
          break;
        case "actual-size":
          remote.current?.setFit(false);
          break;
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [session, report]);
  return (
    <div id="application-viewer">
      <div id="status" role="status">
        {status}
      </div>
      <NoVncView
        ref={remote}
        session={session}
        profile={profile}
        onStatus={report}
        onConnected={setConnected}
      />
      <SiteMenu
        ref={menu}
        session={session}
        profile={profile}
        connected={connected}
        onClosed={onClosed}
      />
    </div>
  );
}

export function ApplicationViewer() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const session = params.get("session") ?? "";
  const profile =
    params.get("profile") || "00000000-0000-4000-8000-000000000001";
  return (
    <ViewerSession
      key={profile + ":" + session}
      session={session}
      profile={profile}
    />
  );
}
