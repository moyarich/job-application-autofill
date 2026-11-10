import { useEffect } from "react";
import { viewerHeaders } from "./api";

/**
 * Subscribe to server-side Playwright session updates.
 * This hook owns SSE transport, framing, reconnection and teardown.
 * UI components receive only a notification callback and never handle SSE.
 */
export function useApplicationEvents(
  session: string,
  profile: string,
  onUpdate: () => void | Promise<void>,
) {
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    // Synchronize once on mount; subsequent refreshes are event-driven.
    void onUpdate();

    async function connect() {
      try {
        const response = await fetch(
          "/api/apply/" + encodeURIComponent(session) + "/events",
          {
            headers: viewerHeaders(profile),
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!response.ok || !response.body)
          throw new Error("Application updates are unavailable.");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
          let boundary: number;
          while ((boundary = buffer.indexOf("\n\n")) !== -1) {
            const event = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            if (event.split("\n").some((line) => line === "event: update"))
              void onUpdate();
          }
          if (buffer.length > 16384) buffer = "";
        }
      } catch {
        // A dropped connection is retried, not polled.
      }
      if (!stopped)
        reconnect = setTimeout(() => { void connect(); }, 2000);
    }

    void connect();
    return () => {
      stopped = true;
      controller.abort();
      if (reconnect) clearTimeout(reconnect);
    };
  }, [session, profile, onUpdate]);
}
