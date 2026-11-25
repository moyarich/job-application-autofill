import { useState } from "react";
import { connectionRequest } from "../../api/connections";

type Run = { id: string; status: string; startedAt: string; finishedAt: string | null; failureCode: string | null; result: { checked: number; unchanged: number; applied: number; deferred: number; failed: number; stopped: boolean } | null };
const statusLabels: Record<string, string> = { running: "Running", completed: "Completed", partial: "Partial", failed: "Failed", interrupted: "Interrupted — outcome uncertain" };
const failureLabels: Record<string, string> = { review_failed: "Could not review records", resolution_failed: "Record resolution failed or was not verified", run_failed: "Synchronization could not finish" };
export function McpSyncHistory({ profileId, connectionId }: { profileId: string; connectionId: string }) {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true); setError("");
    try { setRuns(await connectionRequest<Run[]>(profileId, "connections/" + encodeURIComponent(connectionId) + "/mcp-sync-history")); }
    catch { setError("Could not load synchronization history."); }
    finally { setBusy(false); }
  }
  return <section className="connection-inspection">
    <h4>Synchronization history</h4>
    <button type="button" disabled={busy} onClick={() => void load()}>{runs ? "Refresh history" : "View history"}</button>
    {error && <p role="alert">{error}</p>}
    {runs && (runs.length ? <><p>Most recent 50 runs. Interrupted runs show last recorded progress, not a confirmed outcome.</p>
      <table><thead><tr><th>Started</th><th>Status</th><th>Applied</th><th>Deferred</th><th>Failed</th></tr></thead><tbody>
        {runs.map((run) => <tr key={run.id}><td><details><summary>{new Date(run.startedAt).toLocaleString()}</summary>
          <p>Finished: {run.finishedAt ? new Date(run.finishedAt).toLocaleString() : "Not recorded"}</p>
          {run.result && <p>Checked: {run.result.checked}; unchanged: {run.result.unchanged}</p>}
          {run.failureCode && <p>{failureLabels[run.failureCode] ?? "Run failed"}</p>}
          {run.status === "interrupted" && <p>Review current records before retrying.</p>}
        </details></td><td>{statusLabels[run.status] ?? run.status}</td><td>{run.result?.applied ?? "—"}</td><td>{run.result?.deferred ?? "—"}</td><td>{run.result?.failed ?? "—"}</td></tr>)}
      </tbody></table></> : <p>No synchronization runs yet.</p>)}
  </section>;
}
