import { useState } from "react";
import { connectionRequest, type ConnectionTool } from "../../api/connections";

const fieldNames = ["company", "role", "url", "notes", "status"] as const;
type Workflow = { tool: string; args: Record<string, unknown>; recordsPath: string; fields: Record<string, string> };
type Candidate = { index: number; company: string; role: string; url: string; notes: string; status: string };
type Preview = { previewId: string; records: Candidate[]; invalid: number; duplicates: number };

export function McpApplicationImport({ profileId, connectionId }: { profileId: string; connectionId: string }) {
  const path = "connections/" + encodeURIComponent(connectionId);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tools, setTools] = useState<ConnectionTool[]>([]);
  const [tool, setTool] = useState("");
  const [args, setArgs] = useState("{}");
  const [recordsPath, setRecordsPath] = useState("/records");
  const [fields, setFields] = useState<Record<string, string>>({ company: "/company", role: "/role", url: "/url" });
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  function invalidate() { setSaved(false); setPreview(null); setSelected([]); }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setNotice(""); setError("");
    try { await action(); } catch { setError("Import operation failed. Review the mapping or refresh the preview before retrying. Some selected records may already have been imported."); } finally { setBusy(false); }
  }
  return <section className="connection-inspection">
    <h3>Application import workflow</h3>
    <button type="button" disabled={busy} onClick={() => {
      if (open) { setOpen(false); setPreview(null); return; }
      void run(async () => {
        const [available, existing] = await Promise.all([
          connectionRequest<ConnectionTool[]>(profileId, path + "/tools"),
          connectionRequest<Workflow | null>(profileId, path + "/import-workflow"),
        ]);
        setTools(available.filter((item) => item.access === "read"));
        setTool(existing?.tool ?? "");
        setArgs(JSON.stringify(existing?.args ?? {}, null, 2));
        setRecordsPath(existing?.recordsPath ?? "/records");
        setFields(existing?.fields ?? { company: "/company", role: "/role", url: "/url" });
        setSaved(!!existing); setOpen(true);
      });
    }}>{open ? "Close import workflow" : "Configure import"}</button>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {open && <fieldset disabled={busy} className="connections-form">
      <legend>Map structured MCP response data</legend>
      <label>Approved read tool<select value={tool} onChange={(event) => { setTool(event.target.value); invalidate(); }}>
        <option value="">Choose tool</option>{tools.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
      </select></label>
      <label>Tool arguments (JSON object)<textarea value={args} onChange={(event) => { setArgs(event.target.value); invalidate(); }} /></label>
      <label>Record array JSON Pointer<input value={recordsPath} onChange={(event) => { setRecordsPath(event.target.value); invalidate(); }} /></label>
      <p>Paths are relative to structuredContent for the array and each record for field mappings. Use /records for an array property or leave the array path empty for a root array. Do not store secrets in arguments.</p>
      {fieldNames.map((field) => <label key={field}>{field} {["company", "role", "url"].includes(field) ? "(required)" : "(optional)"}
        <input value={fields[field] ?? ""} placeholder={"/" + field} onChange={(event) => { setFields((current) => ({ ...current, [field]: event.target.value })); invalidate(); }} />
      </label>)}
      <p>Unmapped status defaults to saved. Mapped statuses must use local status identifiers. Only HTTPS job URLs are imported.</p>
      <button type="button" disabled={!tool || !fields.company || !fields.role || !fields.url} onClick={() => void run(async () => {
        await connectionRequest(profileId, path + "/import-workflow", "PUT", { tool, args: JSON.parse(args), recordsPath, fields: Object.fromEntries(Object.entries(fields).filter(([, value]) => !!value)) });
        setSaved(true); setNotice("Import workflow saved.");
      })}>Save import workflow</button>
      <button type="button" disabled={!saved} onClick={() => void run(async () => {
        setPreview(null); setSelected([]);
        const result = await connectionRequest<Preview>(profileId, path + "/import-workflow/preview", "POST", {});
        setPreview(result);
      })}>Preview import</button>
      {preview && <div className="connections-confirm">
        <p>{preview.records.length} candidates · {preview.invalid} invalid · {preview.duplicates} duplicates</p>
        <label className="connections-checkbox"><input type="checkbox" checked={preview.records.length > 0 && selected.length === preview.records.length} onChange={(event) => setSelected(event.target.checked ? preview.records.map((record) => record.index) : [])} /> Select all valid records</label>
        {preview.records.map((record) => <div key={record.index}>
          <label className="connections-checkbox"><input type="checkbox" checked={selected.includes(record.index)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, record.index] : current.filter((index) => index !== record.index))} /> {record.company} — {record.role}</label>
          <details><summary>Review application data</summary><pre>{JSON.stringify(record, null, 2)}</pre></details>
        </div>)}
        <p>Selected records will be created locally. Existing applications will not be overwritten. Preview expires after five minutes.</p>
        <button type="button" disabled={!selected.length} onClick={() => {
          const payload = { previewId: preview.previewId, indices: selected };
          setPreview(null); setSelected([]);
          void run(async () => {
            const result = await connectionRequest<{ imported: number; skipped: number }>(profileId, path + "/import-workflow/execute", "POST", payload);
            setNotice("Imported " + result.imported + "; skipped " + result.skipped + ".");
          });
        }}>Confirm import ({selected.length})</button>
        <button type="button" onClick={() => { setPreview(null); setSelected([]); }}>Cancel</button>
      </div>}
    </fieldset>}
  </section>;
}
