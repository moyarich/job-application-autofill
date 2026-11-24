import { useEffect, useState } from "react";
import { connectionRequest } from "../../api/connections";

type Schedule = { intervalMinutes: number; nextRunAt: string };
const intervals = [
  [15, "15 minutes"], [30, "30 minutes"], [60, "1 hour"],
  [180, "3 hours"], [360, "6 hours"], [720, "12 hours"], [1440, "24 hours"],
] as const;

export function ConnectionSchedule({ profileId, connectionId, allowWrites }: {
  profileId: string;
  connectionId: string;
  allowWrites: boolean;
}) {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [interval, setIntervalMinutes] = useState("60");
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const path = "connections/" + encodeURIComponent(connectionId) + "/schedule";

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setLoaded(false);
    setError("");
    void connectionRequest<Schedule | null>(profileId, path, "GET", undefined, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setSchedule(value);
        setIntervalMinutes(String(value?.intervalMinutes ?? 60));
        setLoaded(true);
      })
      .catch(() => { if (!controller.signal.aborted) setError("Could not load schedule."); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [profileId, path]);

  async function save(intervalMinutes: number | null) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setSchedule(await connectionRequest<Schedule | null>(profileId, path, "PUT", { intervalMinutes }));
    } catch {
      setError("Could not save schedule. Save a field mapping first and check the connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="connection-inspection">
      <h3>Scheduled synchronization</h3>
      <p>Opt in to synchronize linked records while the local API is running. {allowWrites ? "Non-conflicting changes may be sent to Airtable." : "Only local records may be updated."} Conflicts remain for review. A failed run pauses the schedule.</p>
      {error && <p role="alert">{error}</p>}
      {loaded && <>
        <p role="status">{schedule ? "Enabled · Next run: " + new Date(schedule.nextRunAt).toLocaleString() : "Disabled"}</p>
        <label>
          Synchronize every
          <select disabled={busy} value={interval} onChange={(event) => setIntervalMinutes(event.target.value)}>
            {intervals.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <div className="actions">
          <button type="button" disabled={busy} onClick={() => void save(Number(interval))}>
            {schedule ? "Update schedule" : "Enable schedule"}
          </button>
          {schedule && <button type="button" disabled={busy} onClick={() => void save(null)}>Disable schedule</button>}
        </div>
      </>}
    </section>
  );
}
