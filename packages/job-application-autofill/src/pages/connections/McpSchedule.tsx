import { useEffect, useState } from "react";
import { connectionRequest } from "../../api/connections";
type Schedule = { intervalMinutes: number; nextRunAt: string; allowRemoteWrites: boolean; pauseReason: string | null };
const intervals = [[15,"15 minutes"],[30,"30 minutes"],[60,"1 hour"],[180,"3 hours"],[360,"6 hours"],[720,"12 hours"],[1440,"24 hours"]] as const;
const reasons: Record<string, string> = { configuration_changed: "Configuration changed", run_failed: "Run failed or was not verified", interrupted: "Previous run interrupted" };
export function McpSchedule({ profileId, connectionId, updateToken }: { profileId: string; connectionId: string; updateToken: string | null }) {
  const path = "connections/" + encodeURIComponent(connectionId) + "/mcp-schedule";
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [interval, setInterval] = useState("60");
  const [push, setPush] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false); setError(""); setConfirm(false);
    void connectionRequest<Schedule | null>(profileId, path, "GET", undefined, controller.signal).then((value) => {
      if (controller.signal.aborted) return;
      setSchedule(value); setInterval(String(value?.intervalMinutes ?? 60)); setPush(false); setLoaded(true);
    }).catch(() => { if (!controller.signal.aborted) setError("Could not load schedule."); });
    return () => controller.abort();
  }, [profileId, path]);
  async function refresh() {
    setBusy(true); setError(""); setConfirm(false);
    try { setSchedule(await connectionRequest<Schedule | null>(profileId, path)); setLoaded(true); }
    catch { setError("Could not refresh schedule."); }
    finally { setBusy(false); }
  }
  async function save(disable: boolean) {
    setBusy(true); setError(""); setConfirm(false);
    try {
      setSchedule(await connectionRequest<Schedule | null>(profileId, path, "PUT", disable ? { intervalMinutes: null } : { intervalMinutes: Number(interval), confirm: true, allowRemoteWrites: push, updateToken: push ? updateToken : null }));
    } catch { setError("Could not save schedule. Verify the import mapping and update configuration."); }
    finally { setBusy(false); }
  }
  return <section className="connection-inspection">
    <h4>Scheduled synchronization</h4>
    <p>Opt in to run safe synchronization batches while the local API is running. Conflicts and unverified baselines remain for review.</p>
    <button type="button" disabled={busy} onClick={() => void refresh()}>Refresh schedule</button>
    {error && <p role="alert">{error}</p>}
    {loaded && <>
      <p role="status">{schedule ? schedule.pauseReason ? "Paused — " + (reasons[schedule.pauseReason] ?? "Review required") : "Enabled · Next run: " + new Date(schedule.nextRunAt).toLocaleString() : "Disabled"}</p>
      {schedule && <p>Saved permission: {schedule.allowRemoteWrites ? "Local and remote updates" : "Local updates only"}</p>}
      <label>Synchronize every<select disabled={busy} value={interval} onChange={(event) => { setInterval(event.target.value); setConfirm(false); }}>{intervals.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="connections-checkbox"><input type="checkbox" checked={push && !!updateToken} disabled={busy || !updateToken} onChange={(event) => { setPush(event.target.checked); setConfirm(false); }} /> Permit recurring remote updates using the loaded update workflow</label>
      {!updateToken && <p>Load the saved update workflow before authorizing remote writes.</p>}
      <button type="button" disabled={busy} onClick={() => setConfirm(true)}>{schedule ? "Update or resume schedule" : "Enable schedule"}</button>
      {schedule && <button type="button" disabled={busy} onClick={() => void save(true)}>Disable schedule</button>}
      {confirm && <div className="connections-confirm">
        <p>Authorize recurring {push ? "local and remote" : "local-only"} updates? Failed or interrupted runs pause the schedule. Disabling does not cancel a run already in progress.</p>
        <button type="button" disabled={busy || (push && !updateToken)} onClick={() => void save(false)}>Confirm schedule</button>
        <button type="button" onClick={() => setConfirm(false)}>Cancel</button>
      </div>}
    </>}
  </section>;
}
