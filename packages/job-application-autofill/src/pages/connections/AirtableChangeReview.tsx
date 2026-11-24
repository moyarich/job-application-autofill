import { useState } from "react";
import { connectionRequest } from "../../api/connections";

type Change = {
  applicationId: string;
  remoteId: string;
  reviewToken: string;
  state: "unchanged" | "local_changed" | "remote_changed" | "conflict" | "converged" | "diverged" | "remote_missing";
  local: Record<string, string>;
  remote: Record<string, unknown> | null;
};
type Report = { checkedAt: string; changes: Change[] };
const labels: Record<Change["state"], string> = {
  unchanged: "Unchanged",
  local_changed: "Changed locally",
  remote_changed: "Changed in Airtable",
  conflict: "Both sides changed",
  converged: "Both sides now match",
  diverged: "Different baseline values",
  remote_missing: "Remote record missing",
};
const fields = [
  ["company", "Company"],
  ["role", "Job title"],
  ["url", "Job URL"],
  ["notes", "Notes"],
] as const;

function display(value: unknown): string {
  if (typeof value === "string") return value || "—";
  return value == null ? "—" : JSON.stringify(value) ?? "—";
}

export function AirtableChangeReview({
  profileId,
  connectionId,
  disabled,
  allowWrites,
}: {
  profileId: string;
  connectionId: string;
  disabled: boolean;
  allowWrites: boolean;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ item: Change; choice: "local" | "remote" } | null>(null);
  const [notice, setNotice] = useState("");
  async function resolve() {
    if (!pending || busy || disabled) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await connectionRequest(profileId, "connections/" + encodeURIComponent(connectionId) + "/resolve", "POST", {
        applicationId: pending.item.applicationId,
        reviewToken: pending.item.reviewToken,
        choice: pending.choice,
      });
      setNotice("Resolution applied. Check for changes again.");
    } catch {
      setError("Resolution could not be confirmed. Check for changes again before retrying.");
    } finally {
      setPending(null);
      setReport(null);
      setBusy(false);
    }
  }
  async function review() {
    setBusy(true);
    setError("");
    setReport(null);
    setPending(null);
    setNotice("");
    try {
      setReport(await connectionRequest<Report>(
        profileId,
        "connections/" + encodeURIComponent(connectionId) + "/changes",
      ));
    } catch {
      setError("Could not check changes. Verify the connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  const changes = report?.changes.filter((item) => item.state !== "unchanged") ?? [];
  return (
    <section className="connection-inspection">
      <h3>Review linked applications</h3>
      <p>Compare mapped fields without changing local or Airtable records.</p>
      <button type="button" disabled={busy || disabled} onClick={() => void review()}>
        {busy ? "Checking changes…" : "Check for changes"}
      </button>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {report && (
        <>
          <p role="status">
            Checked {report.changes.length} linked applications; {changes.length} need review.
          </p>
          <p>Checked at {new Date(report.checkedAt).toLocaleString()}. Results may change.</p>
          {changes.map((item) => (
            <details key={item.applicationId}>
              <summary>{item.local.company} — {item.local.role}: {labels[item.state]}</summary>
              {item.remote ? (
                <div className="connection-comparison">
                  <table>
                    <thead>
                      <tr><th>Field</th><th>Local</th><th>Airtable</th></tr>
                    </thead>
                    <tbody>
                      {fields.map(([key, label]) => (
                        <tr key={key}>
                          <th scope="row">{label}</th>
                          <td>{display(item.local[key])}</td>
                          <td>{display(item.remote?.[key])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p>The linked Airtable record was not found. Nothing was deleted.</p>}
              {item.remote && (
                <div className="actions">
                  {allowWrites && <button type="button" disabled={busy || disabled} onClick={() => setPending({ item, choice: "local" })}>Keep local</button>}
                  <button type="button" disabled={busy || disabled} onClick={() => setPending({ item, choice: "remote" })}>Keep Airtable</button>
                  <button type="button" disabled={busy || disabled} onClick={() => { setPending(null); setReport((current) => current ? { ...current, changes: current.changes.filter((change) => change.applicationId !== item.applicationId) } : null); }}>Skip</button>
                </div>
              )}
              {pending?.item.applicationId === item.applicationId && (
                <div className="connections-confirm">
                  <p>Replace the mapped fields in {pending.choice === "local" ? "Airtable" : "the local application"} with the reviewed version?</p>
                  <button type="button" disabled={busy || disabled} onClick={() => void resolve()}>Confirm resolution</button>
                  <button type="button" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
                </div>
              )}
            </details>
          ))}
        </>
      )}
    </section>
  );
}
