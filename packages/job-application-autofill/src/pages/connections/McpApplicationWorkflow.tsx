import { useState } from "react";
import { connectionRequest, type ConnectionTool } from "../../api/connections";
import { readJobs } from "../../api/client";
import type { JobApplication } from "../../types/job-application";

const sources = ["id", "company", "role", "url", "status", "createdAt", "notes"] as const;
type Source = (typeof sources)[number];
type Workflow = { tool: string; fields: Record<string, Source>; constants: Record<string, unknown>; remoteIdPath?: string };
type Preview = { tool: string; args: Record<string, unknown>; reviewToken: string };
export function McpApplicationWorkflow({ profileId, connectionId }: { profileId: string; connectionId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tools, setTools] = useState<ConnectionTool[]>([]);
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [tool, setTool] = useState("");
  const [fields, setFields] = useState<Record<string, Source>>({});
  const [constants, setConstants] = useState("{}");
  const [remoteIdPath, setRemoteIdPath] = useState("");
  const [saved, setSaved] = useState(false);
  const [jobId, setJobId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const path = "connections/" + encodeURIComponent(connectionId);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await action(); } catch { setError("Operation failed or could not be confirmed. Review before retrying."); } finally { setBusy(false); }
  }
  function invalidate() { setSaved(false); setPreview(null); }
  const properties = tools.find((item) => item.name === tool)?.inputSchema.properties;
  const names = properties && typeof properties === "object" && !Array.isArray(properties) ? Object.keys(properties) : [];
  return <section className="connection-inspection">
    <h3>Application export workflow</h3>
    <button type="button" disabled={busy} onClick={() => {
      if (open) { setOpen(false); setPreview(null); return; }
      void run(async () => {
        const [available, existing, applications] = await Promise.all([
          connectionRequest<ConnectionTool[]>(profileId, path + "/tools"),
          connectionRequest<Workflow | null>(profileId, path + "/workflow"),
          readJobs(profileId),
        ]);
        setTools(available.filter((item) => item.access === "write"));
        setJobs(applications.jobs);
        setTool(existing?.tool ?? ""); setFields(existing?.fields ?? {});
        setRemoteIdPath(existing?.remoteIdPath ?? "");
        setConstants(JSON.stringify(existing?.constants ?? {}, null, 2)); setSaved(!!existing); setOpen(true);
      });
    }}>{open ? "Close workflow" : "Configure workflow"}</button>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {open && <fieldset disabled={busy} className="connections-form">
      <legend>Map application fields to an approved write tool</legend>
      <label>Tool<select value={tool} onChange={(event) => { setTool(event.target.value); setFields({}); setConstants("{}"); invalidate(); }}>
        <option value="">Choose tool</option>
        {tools.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
      </select></label>
      {names.map((name) => <label key={name}>{name}<select value={Object.hasOwn(fields, name) ? fields[name] : ""} onChange={(event) => {
        const value = event.target.value;
        setFields((current) => Object.fromEntries([...Object.entries(current).filter(([key]) => key !== name), ...(value ? [[name, value as Source] as const] : [])]));
        invalidate();
      }}><option value="">Not mapped / constant</option>{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select></label>)}
      <label>Constant arguments (JSON object)<textarea value={constants} onChange={(event) => { setConstants(event.target.value); invalidate(); }} /></label>
      <label>Returned record ID pointer (optional)<input value={remoteIdPath} placeholder="/id" onChange={(event) => { setRemoteIdPath(event.target.value); invalidate(); }} /></label>
      <p>Tracked exports with uncertain outcomes block repeat exports of that application.</p>
      <p>Use constants for destination IDs and other fixed parameters, not secrets. Notes may contain private information.</p>
      <button type="button" disabled={!tool || !Object.keys(fields).length} onClick={() => void run(async () => {
        await connectionRequest(profileId, path + "/workflow", "PUT", { tool, fields, constants: JSON.parse(constants), ...(remoteIdPath ? { remoteIdPath } : {}) });
        setSaved(true); setNotice("Workflow saved.");
      })}>Save workflow</button>
      <label>Application<select value={jobId} onChange={(event) => { setJobId(event.target.value); setPreview(null); }}>
        <option value="">Choose application</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.company} — {job.role}</option>)}
      </select></label>
      <button type="button" disabled={!saved || !jobId} onClick={() => void run(async () => {
        setPreview(null); setPreview(await connectionRequest<Preview>(profileId, path + "/workflow/preview", "POST", { jobId }));
      })}>Preview export</button>
      {preview && <div className="connections-confirm">
        <p>Send these arguments to {preview.tool}? The remote tool may create or change records. Repeating an export may create duplicates.</p>
        <pre>{JSON.stringify(preview.args, null, 2)}</pre>
        <button type="button" onClick={() => {
          const reviewToken = preview.reviewToken; setPreview(null);
          void run(async () => { await connectionRequest(profileId, path + "/workflow/execute", "POST", { jobId, reviewToken }); setNotice("Remote tool completed."); });
        }}>Confirm export</button>
        <button type="button" onClick={() => setPreview(null)}>Cancel</button>
      </div>}
    </fieldset>}
  </section>;
}
