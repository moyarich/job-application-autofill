import type { ReactNode, Dispatch, SetStateAction } from "react";

/** Purely presentational; page hooks remain independent. */
export function PageStatus({ hydrated, message, setMessage, children }: {
  hydrated: boolean;
  message: string;
  setMessage: Dispatch<SetStateAction<string>>;
  children: ReactNode;
}) {
  if (!hydrated) return (
    <section className="main" aria-busy="true">
      <h1>Opening your workspace</h1>
      <p>{message || "Loading your information..."}</p>
    </section>
  );
  return (
    <>
      {message && (
        <div className="notice" role="status">
          {message}
          <button onClick={() => setMessage("")} aria-label="Dismiss notification">×</button>
        </div>
      )}
      {children}
    </>
  );
}
