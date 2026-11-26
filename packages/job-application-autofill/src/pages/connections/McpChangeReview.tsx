import { useState } from "react";
import { connectionRequest } from "../../api/connections";

const labels = {
  unchanged: "Unchanged", local_changed: "Local changed", remote_changed: "Remote changed",
  conflict: "Both changed", converged: "Matching changes", baseline_unverified: "Baseline not verified",
  not_returned: "Not returned by read tool", invalid_remote: "Invalid or ambiguous remote record",
};
type Change = { applicationId: string; remoteId: string; state: keyof typeof labels; local: Record<string, string>; remote: Record<string, string> | null };
type Report = { checkedAt: string; changes: Change[] };
export function McpChangeReview({ profileId, connectionId }: { profileId: string; connectionId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showUnchanged, setShowUnchanged] = useState(false);
  async function review() {
    setBusy(true); setError(""); setReport(null);
    try {
      setReport(await connectionRequest<Report>(profileId, "connections/" + encodeURIComponent(connectionId) + "/mcp-changes", "POST", {}));
    } catch { setError("Could not review changes. Configure an import workflow with stable remote IDs and an approved read tool."); }
    finally { setBusy(false); }
  }
  return <section className="connection-inspection">
    <h4>Review record changes</h4>
    <p>Read-only comparison. Records absent from this response may be on another page or excluded by a filter.</p>
    <button type="button" disabled={busy} onClick={() => void review()}>{busy ? "Checking…" : "Check for changes"}</button>
    {error && <p role="alert">{error}</p>}
    {report && <>
      <p>{report.changes.length} linked records checked · {new Date(report.checkedAt).toLocaleString()}</p>
      <label className="connections-checkbox"><input type="checkbox" checked={showUnchanged} onChange={(event) => setShowUnchanged(event.target.checked)} /> Show unchanged records</label>
      {report.changes.filter((item) => showUnchanged || item.state !== "unchanged").map((item) => <details key={item.applicationId}>
        <summary>{item.local.company} — {item.local.role} · {labels[item.state]}</summary>
        <p>Remote ID: {item.remoteId}</p>
        <div className="connection-comparison"><table><thead><tr><th>Field</th><th>Local</th><th>Remote</th></tr></thead><tbody>
          {Object.entries(item.local).map(([field, value]) => <tr key={field}><th scope="row">{field}</th><td>{value}</td><td>{item.remote?.[field] ?? "—"}</td></tr>)}
        </tbody></table></div>
      </details>)}
    </>}
  </section>;
}
