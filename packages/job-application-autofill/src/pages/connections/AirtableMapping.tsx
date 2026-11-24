import { useState } from "react";
import { AirtableChangeReview } from "./AirtableChangeReview";
import { connectionRequest, type Connection } from "../../api/connections";
import { readJobs } from "../../api/client";
import type { JobApplication } from "../../types/job-application";

const fields = ["company", "role", "url", "notes"] as const;
type Field = (typeof fields)[number];
type Mapping = {
  baseId: string;
  tableId: string;
  fields: Record<Field, string>;
};
type Base = { id: string; name: string };
type Table = {
  id: string;
  name: string;
  fields: { id: string; name: string; type: string }[];
};

const emptyMapping = (): Mapping => ({
  baseId: "",
  tableId: "",
  fields: { company: "", role: "", url: "", notes: "" },
});

export function AirtableMapping({
  profileId,
  connection,
}: {
  profileId: string;
  connection: Connection;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [bases, setBases] = useState<Base[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [mapping, setMapping] = useState<Mapping>(emptyMapping);
  const [saved, setSaved] = useState(false);
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [jobId, setJobId] = useState("");
  const path = "connections/" + encodeURIComponent(connection.id);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await action();
    } catch {
      setError("Operation failed. Check credentials, mapping and permissions.");
    } finally {
      setBusy(false);
    }
  }

  async function loadTables(baseId: string) {
    const result = await connectionRequest<{ tables: Table[] }>(
      profileId,
      path + "/tools/get_schema",
      "POST",
      { baseId },
    );
    setTables(result.tables);
  }

  function configure() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    void run(async () => {
      const available: Base[] = [];
      const seen = new Set<string>();
      let offset: string | undefined;
      do {
        const page: { bases: Base[]; offset?: string } =
          await connectionRequest(
            profileId,
            path + "/tools/list_bases",
            "POST",
            offset ? { offset } : {},
          );
        available.push(...page.bases);
        offset = page.offset;
        if (offset) {
          if (seen.has(offset) || seen.size >= 49)
            throw new Error("Base pagination limit.");
          seen.add(offset);
        }
      } while (offset);
      setBases(available);
      const previous = await connectionRequest<Mapping | null>(
        profileId,
        path + "/mapping",
      );
      setMapping(previous ?? emptyMapping());
      setSaved(Boolean(previous));
      if (previous) await loadTables(previous.baseId);
      setJobs((await readJobs(profileId)).jobs);
    });
  }

  const table = tables.find((item) => item.id === mapping.tableId);
  return (
    <div className="connection-inspection">
      <button type="button" disabled={busy} onClick={configure}>
        {open ? "Close application mapping" : "Configure application mapping"}
      </button>
      {open && (
        <>
          {error && <p role="alert">{error}</p>}
          {message && <p role="status">{message}</p>}
          <fieldset disabled={busy} className="connections-form">
            <legend>Application field mapping</legend>
            <label>
              Airtable base
              <select
                value={mapping.baseId}
                onChange={(event) => {
                  const baseId = event.target.value;
                  setMapping({ ...emptyMapping(), baseId });
                  setTables([]);
                  setSaved(false);
                  if (baseId) void run(() => loadTables(baseId));
                }}
              >
                <option value="">Choose a base</option>
                {bases.map((base) => (
                  <option key={base.id} value={base.id}>{base.name}</option>
                ))}
              </select>
            </label>
            <label>
              Airtable table
              <select
                value={mapping.tableId}
                onChange={(event) => {
                  setMapping({
                    ...emptyMapping(),
                    baseId: mapping.baseId,
                    tableId: event.target.value,
                  });
                  setSaved(false);
                }}
              >
                <option value="">Choose a table</option>
                {tables.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            {fields.map((field) => (
              <label key={field}>
                {field === "role" ? "Job title" : field === "url" ? "Job URL" : field === "company" ? "Company" : "Notes"}
                <select
                  value={mapping.fields[field]}
                  onChange={(event) => {
                    setMapping({
                      ...mapping,
                      fields: { ...mapping.fields, [field]: event.target.value },
                    });
                    setSaved(false);
                  }}
                >
                  <option value="">Choose a field</option>
                  {table?.fields
                    .filter((item) =>
                      ["singleLineText", "multilineText", ...(field === "url" ? ["url"] : [])].includes(item.type),
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                </select>
              </label>
            ))}
            <button
              type="button"
              disabled={!mapping.tableId || fields.some((field) => !mapping.fields[field])}
              onClick={() => void run(async () => {
                await connectionRequest(profileId, path + "/mapping", "PUT", mapping);
                setSaved(true);
                setMessage("Mapping saved.");
              })}
            >
              Save mapping
            </button>
          </fieldset>
          {saved && <AirtableChangeReview profileId={profileId} connectionId={connection.id} disabled={busy} />}
          <p>Transfers create new records only. Matching job URLs are skipped; existing records are not overwritten. Imported applications start as Saved.</p>
          <button
            type="button"
            disabled={busy || !saved}
            onClick={() => void run(async () => {
              const result = await connectionRequest<{ imported: number; skipped: number }>(
                profileId, path + "/import", "POST", {},
              );
              setJobs((await readJobs(profileId)).jobs);
              setMessage("Imported " + result.imported + "; skipped " + result.skipped + ".");
            })}
          >
            Import new applications
          </button>
          {connection.allowWrites && (
            <>
              <label>
                Application to export
                <select value={jobId} disabled={busy} onChange={(event) => setJobId(event.target.value)}>
                  <option value="">Choose an application</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>{job.company} — {job.role}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={busy || !saved || !jobId}
                onClick={() => void run(async () => {
                  const result = await connectionRequest<{ created: boolean }>(
                    profileId, path + "/export", "POST", { jobId },
                  );
                  setMessage(result.created ? "Application exported." : "Matching URL already exists; no changes made.");
                })}
              >
                Export selected application
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
