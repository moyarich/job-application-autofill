import { useState } from "react";
import { connectionRequest } from "../../api/connections";

const labels = {
  unchanged: "Unchanged", local_changed: "Local changed", remote_changed: "Remote changed",
  conflict: "Both changed", converged: "Matching changes", baseline_unverified: "Baseline not verified",
  not_returned: "Not returned by read tool", invalid_remote: "Invalid or ambiguous remote record",
};
type Change = { reviewToken: string; applicationId: string; remoteId: string; state: keyof typeof labels; local: Record<string, string>; remote: Record<string, string> | null };
type Report = { checkedAt: string; changes: Change[] };
export function McpChangeReview({ profileId, connectionId }: { profileId: string; connectionId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [config, setConfig] = useState('{"tool":"","idArgument":"id","fields":{"company":"company","role":"role","url":"url"},"constants":{}}');
  const [updateToken, setUpdateToken] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ item: Change; choice: string } | null>(null);
  const [notice, setNotice] = useState("");
  const path = "connections/" + encodeURIComponent(connectionId);
  const [showUnchanged, setShowUnchanged] = useState(false);
  async function review() {
    setBusy(true); setError(""); setReport(null); setConfirmation(null);
    try {
      setReport(await connectionRequest<Report>(profileId, "connections/" + encodeURIComponent(connectionId) + "/mcp-changes", "POST", {}));
    } catch { setError("Could not review changes. Configure an import workflow with stable remote IDs and an approved read tool."); }
    finally { setBusy(false); }
  }
  return <section className="connection-inspection">
    <h4>Review record changes</h4>
    <p>Comparison is read-only until you confirm a resolution. Records absent from this response may be on another page or excluded by a filter.</p>
    <button type="button" disabled={busy} onClick={() => void review()}>{busy ? "Checking…" : "Check for changes"}</button>
    {error && <p role="alert">{error}</p>}
    <details><summary>Configure approved remote update tool</summary>
      <p>Map the remote ID argument and every reviewed field to declared tool arguments. Use only an update-existing-record tool, not a create tool.</p>
      <button type="button" disabled={busy} onClick={() => { setBusy(true); setError(""); void connectionRequest<{ workflow: unknown; updateToken: string | null }>(profileId, path + "/mcp-update-workflow").then((result) => { if (result.workflow) setConfig(JSON.stringify(result.workflow, null, 2)); setUpdateToken(result.updateToken); }).catch(() => setError("Unable to load update configuration.")).finally(() => setBusy(false)); }}>Load configuration</button>
      <label>Update workflow JSON<textarea value={config} disabled={busy} onChange={(event) => { setConfig(event.target.value); setUpdateToken(null); setConfirmation(null); }} /></label>
      <button type="button" disabled={busy} onClick={() => { setBusy(true); setError(""); setUpdateToken(null); void Promise.resolve().then(() => connectionRequest(profileId, path + "/mcp-update-workflow", "PUT", JSON.parse(config))).then(() => connectionRequest<{ updateToken: string | null }>(profileId, path + "/mcp-update-workflow")).then((result) => setUpdateToken(result.updateToken)).catch(() => setError("Invalid update configuration.")).finally(() => setBusy(false)); }}>Save update configuration</button>
    </details>
    {notice && <p role="status">{notice}</p>}
    {report && <>
      <p>{report.changes.length} linked records checked · {new Date(report.checkedAt).toLocaleString()}</p>
      <label className="connections-checkbox"><input type="checkbox" checked={showUnchanged} onChange={(event) => setShowUnchanged(event.target.checked)} /> Show unchanged records</label>
      {report.changes.filter((item) => showUnchanged || item.state !== "unchanged").map((item) => <details key={item.applicationId}>
        <summary>{item.local.company} — {item.local.role} · {labels[item.state]}</summary>
        <p>Remote ID: {item.remoteId}</p>
        <div className="connection-comparison"><table><thead><tr><th>Field</th><th>Local</th><th>Remote</th></tr></thead><tbody>
          {Object.entries(item.local).map(([field, value]) => <tr key={field}><th scope="row">{field}</th><td>{value}</td><td>{item.remote?.[field] ?? "—"}</td></tr>)}
        </tbody></table></div>
        {item.remote && item.state !== "unchanged" && <>
          <button type="button" disabled={busy} onClick={() => setConfirmation({ item, choice: "remote" })}>Keep remote</button>
          <button type="button" disabled={busy || !updateToken} onClick={() => setConfirmation({ item, choice: "local" })}>Keep local</button>
          {JSON.stringify(item.local) === JSON.stringify(item.remote) && <button type="button" disabled={busy} onClick={() => setConfirmation({ item, choice: "accept" })}>Accept matching values</button>}
        </>}
        {confirmation?.item.applicationId === item.applicationId && <div className="connections-confirm"><p>Confirm {confirmation.choice === "local" ? "remote update using the saved workflow" : confirmation.choice === "remote" ? "local update from remote values" : "baseline verification"}? Values will be checked again.</p>
          <button type="button" disabled={busy} onClick={() => { const choice = confirmation.choice; setConfirmation(null); setBusy(true); setError(""); setNotice(""); void connectionRequest(profileId, path + "/mcp-resolve", "POST", { applicationId: item.applicationId, reviewToken: item.reviewToken, choice, updateToken }).then(() => { setNotice("Resolution verified."); setReport(null); }).catch(() => { setError("Resolution failed or outcome unverified. Check changes before retrying."); setReport(null); }).finally(() => setBusy(false)); }}>Confirm resolution</button>
          <button type="button" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button></div>}
      </details>)}
    </>}
  </section>;
}
