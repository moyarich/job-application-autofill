import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useBeforeUnload, useBlocker } from "react-router";

type PendingSave = { dirty: () => boolean; flush: () => Promise<void> };
const SaveContext = createContext<Map<symbol, PendingSave> | null>(null);

/** Keep page-owned drafts mounted until their writes have completed. */
export function PendingSaves({ children }: { children: ReactNode }) {
  const saves = useRef(new Map<symbol, PendingSave>()).current;
  const [error, setError] = useState("");
  const flushing = useRef(false);
  const hasPending = useCallback(() => [...saves.values()].some((save) => save.dirty()), [saves]);
  const blocker = useBlocker(hasPending);
  useBeforeUnload(useCallback((event) => {
    if (hasPending()) {
      event.preventDefault();
      event.returnValue = "";
    }
  }, [hasPending]));
  useEffect(() => {
    if (blocker.state !== "blocked" || flushing.current) return;
    flushing.current = true;
    void (async () => {
      try {
        for (const save of saves.values()) {
          if (save.dirty()) await save.flush();
        }
        setError("");
        blocker.proceed();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Changes could not be saved. Stay on this page and retry.");
        blocker.reset();
      } finally {
        flushing.current = false;
      }
    })();
  }, [blocker, saves]);
  return <SaveContext.Provider value={saves}>
    {error && <p className="notice" role="alert">{error}</p>}
    {children}
  </SaveContext.Provider>;
}

export function usePendingSave(dirty: () => boolean, flush: () => Promise<void>) {
  const saves = useContext(SaveContext);
  const current = useRef({ dirty, flush });
  current.current = { dirty, flush };
  useEffect(() => {
    if (!saves) return;
    const id = Symbol("pending-save");
    saves.set(id, { dirty: () => current.current.dirty(), flush: () => current.current.flush() });
    return () => { saves.delete(id); };
  }, [saves]);
}
