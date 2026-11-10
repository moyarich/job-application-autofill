import { useEffect } from "react";
import { subscribeAutomationEvents } from "../../api/events";

/** React lifecycle wrapper; the SSE transport lives in src/api. */
export function useAutomationEvents(
  session: string,
  profile: string,
  onUpdate: () => void | Promise<void>,
) {
  useEffect(() => {
    if (!session) return;
    return subscribeAutomationEvents(session, profile, onUpdate);
  }, [session, profile, onUpdate]);
}
