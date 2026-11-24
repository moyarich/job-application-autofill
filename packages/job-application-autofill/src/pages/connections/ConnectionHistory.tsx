import { useState } from "react";
import { connectionRequest } from "../../api/connections";

type Run = {
  id: string;
  direction: "import" | "export" | "sync";
  status: "running" | "completed" | "partial" | "failed" | "interrupted";
  startedAt: string;
  finishedAt: string | null;
  failureCode: string | null;
  result: Record<string, unknown> | null;
};

const directions = { import: "Import / pull", export: "Export / push", sync: "Synchronization" };
const statuses = { running: "Running", completed: "Completed", partial: "Stopped with errors", failed: "Failed", interrupted: "Interrupted" };
const metrics = [
  ["checked", "Checked"], ["pulled", "Pulled"], ["pushed", "Pushed"],
  ["converged", "Converged"], ["unchanged", "Unchanged"],
  ["needsReview", "Needs review"], ["deferred", "Deferred"],
  ["failed", "Failed"], ["imported", "Imported"], ["skipped", "Skipped"],
] as const;

function summary(run: Run) {
  if (!run.result) return "—";
  const counts = metrics.flatMap(([key, label]) =>
    typeof run.result?.[key] === "number" ? [label + ": " + run.result[key]] : [],
  );
  if (counts.length) return counts.join(" · ");
  if (run.result.resolved === true) return "Resolution applied";
  if (run.result.created === true) return "Record created";
  if (run.result.created === false) return "No record created";
  return "—";
}

function failure(run: Run) {
  if (run.status === "interrupted") return "Run did not finish. Review records before retrying.";
  if (run.failureCode === "review_failed") return "Could not review linked records.";
  if (run.failureCode === "resolution_failed") return "A record update failed or could not be confirmed.";
  if (run.status === "failed") return "Operation failed. Check connection and review records before retrying.";
  return "";
}

export function ConnectionHistory({ profileId, connectionId }: { profileId: string; connectionId: string }) {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function refresh() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setRuns(await connectionRequest<Run[]>(profileId, "connections/" + encodeURIComponent(connectionId) + "/history"));
    } catch {
      setError("Could not load transfer history.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="connection-inspection">
      <h3>Synchronization history</h3>
      <button type="button" disabled={busy} onClick={() => void refresh()}>
        {busy ? "Loading history…" : runs === null ? "View history" : "Refresh history"}
      </button>
      {error && <p role="alert">{error}</p>}
      {runs !== null && (
        <>
          <p>Latest 50 runs. Individual updates within a synchronization also appear as imports or exports.</p>
          {runs.length === 0 ? <p>No transfer history.</p> : (
            <div className="connection-comparison">
              <table>
                <thead><tr><th>Operation</th><th>Status</th><th>Started / finished</th><th>Results</th></tr></thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td>{directions[run.direction]}</td>
                      <td>{statuses[run.status]}</td>
                      <td>{new Date(run.startedAt).toLocaleString()}<br />{run.finishedAt ? new Date(run.finishedAt).toLocaleString() : "—"}</td>
                      <td>{summary(run)}{failure(run) && <p>{failure(run)}</p>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
