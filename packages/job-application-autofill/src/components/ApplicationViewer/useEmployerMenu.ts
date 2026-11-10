import { useCallback, useEffect, useRef, useState } from "react";
import {
  menuError,
  viewerRequest,
  type MenuItem,
  type ViewerSession,
} from "./api";
import { useApplicationEvents } from "./useApplicationEvents";

export function useEmployerMenu(
  session: string,
  profile: string,
  _connected: boolean,
  onClosed: () => void,
) {
  const [active, setActive] = useState<ViewerSession | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false),
    closed = useRef(false);
  const pending = useRef<Promise<void> | null>(null);
  const actions = useRef(new Set<string>());
  const base = "/api/apply/" + encodeURIComponent(session);
  const refresh = useCallback(async () => {
    if (!session || closed.current || !mounted.current) return;
    if (pending.current) return pending.current;
    pending.current = (async () => {
      try {
        const data = await viewerRequest<{
          items?: MenuItem[];
          session?: ViewerSession;
        }>(base + "/menu", profile);
        const nextItems = Array.isArray(data.items) ? data.items : [];
        let next =
          data.session ?? (await viewerRequest<ViewerSession>(base, profile));
        if (
          !data.session &&
          next.state === "login_required" &&
          nextItems.length &&
          !next.running &&
          !next.paused
        )
          next = { ...next, state: "ready_for_review" };
        if (mounted.current && !closed.current) {
          setActive(next);
          setItems(nextItems);
        }
      } catch (cause) {
        if (!mounted.current) return;
        if (
          /expired|not found|closed|unknown.*session/i.test(
            cause instanceof Error ? cause.message : "",
          )
        )
          setActive(null);
        else setError(menuError(cause));
      }
    })().finally(() => {
      pending.current = null;
    });
    return pending.current;
  }, [base, profile, session]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useApplicationEvents(session, profile, refresh);
  async function run(
    action: "continue" | "pause" | "close" | "menu",
    itemId?: string,
  ) {
    const key = itemId ?? action;
    if (
      closed.current ||
      actions.current.has(key) ||
      (actions.current.size && action !== "pause" && action !== "close")
    )
      return;
    if (
      action === "close" &&
      !window.confirm("Stop automation and close the application browser?")
    )
      return;
    actions.current.add(key);
    setBusy(true);
    setError("");
    try {
      await viewerRequest(
        base + "/" + action,
        profile,
        action === "menu" ? { itemId } : {},
      );
      if (action === "close") {
        closed.current = true;
        if (mounted.current) {
          setActive(null);
          onClosed();
        }
      }
    } catch (cause) {
      if (mounted.current) setError(menuError(cause));
    } finally {
      actions.current.delete(key);
      if (mounted.current) setBusy(actions.current.size > 0);
      if (!closed.current) await refresh();
    }
  }
  return { active, items, busy, error, refresh, run };
}
