import { useState } from "react";
import { connectionRequest } from "../../api/connections";
type Report = { links: { applicationId: string; remoteId: string; direction: string; linkedAt: string }[]; uncertainExports: { applicationId: string; attemptedAt: string }[] };
export function McpRecordLinks({ profileId, connectionId }: { profileId: string; connectionId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function refresh() {
    setBusy(true); setError("");
    try { setReport(await connectionRequest<Report>(profileId, "connections/" + encodeURIComponent(connectionId) + "/mcp-links")); }
    catch { setError("Could not load record associations."); }
    finally { setBusy(false); }
  }
  return <section className="connection-inspection">
    <h3>Record associations</h3>
    <button type="button" disabled={busy} onClick={() => void refresh()}>{report ? "Refresh associations" : "View associations"}</button>
    {error && <p role="alert">{error}</p>}
    {report && <>
      <p>{report.links.length} linked applications</p>
      <ul>{report.links.map((link) => <li key={link.applicationId}>{link.applicationId} — {link.remoteId} ({link.direction})</li>)}</ul>
      {report.uncertainExports.length > 0 && <><p role="alert">Some exports have uncertain outcomes. Verify remote records before attempting another transfer. Automatic retry is blocked.</p><ul>{report.uncertainExports.map((item) => <li key={item.applicationId}>{item.applicationId} — {item.attemptedAt}</li>)}</ul></>}
    </>}
  </section>;
}
