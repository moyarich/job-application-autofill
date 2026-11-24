import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { createConnections } from "./connections.ts";
import Ajv, { type AnySchema } from "ajv";
import { remoteIdentifier, validRemotePointer, type createMcpLinks } from "./mcp-links.ts";

const statuses = new Set(["saved", "in_progress", "ready_for_review", "submitted", "interview", "rejected"]);
const required = ["company", "role", "url"] as const;
const optional = ["notes", "status"] as const;
type Field = (typeof required)[number] | (typeof optional)[number];
type Mapping = Record<(typeof required)[number], string> & Partial<Record<(typeof optional)[number], string>>;
type Workflow = { tool: string; args: Record<string, unknown>; recordsPath: string; fields: Mapping; remoteIdPath?: string };
type Candidate = { index: number; remoteId?: string; company: string; role: string; url: string; notes: string; status: string };
type Preview = { owner: string; connectionId: string; config: string; expires: number; records: Candidate[] };
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function pathValid(value: unknown): value is string {
  return typeof value === "string" && value.length <= 512 &&
    (value === "" || (value.startsWith("/") && !/~(?![01])/.test(value) && value.split("/").length <= 20));
}
/** JSON Pointer with own-property access only; never evaluates remote text. */
export function pointer(value: unknown, path: string): unknown {
  if (!pathValid(path)) throw new Error("Invalid JSON pointer.");
  if (path === "") return value;
  for (const segment of path.slice(1).split("/")) {
    const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    if ((!object(value) && !Array.isArray(value)) || !Object.hasOwn(value, key)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}
export function parseImportWorkflow(raw: unknown): Workflow {
  if (!object(raw) || Object.keys(raw).some((key) => !["tool", "args", "recordsPath", "fields", "remoteIdPath"].includes(key)) ||
    typeof raw.tool !== "string" || !/^[A-Za-z0-9_.-]{1,128}$/.test(raw.tool) ||
    !object(raw.args) || JSON.stringify(raw.args).length > 16000 ||
    !pathValid(raw.recordsPath) || (raw.remoteIdPath !== undefined && !validRemotePointer(raw.remoteIdPath)) || !object(raw.fields)) throw new Error("Invalid import workflow.");
  const fields = raw.fields;
  if (required.some((field) => !pathValid(fields[field]) || fields[field] === "") ||
    Object.entries(fields).some(([key, value]) => ![...required, ...optional].includes(key as Field) || !pathValid(value) || value === ""))
    throw new Error("Invalid response mapping.");
  return { tool: raw.tool, args: raw.args, recordsPath: raw.recordsPath, fields: fields as Mapping, ...(typeof raw.remoteIdPath === "string" ? { remoteIdPath: raw.remoteIdPath } : {}) };
}
export function normalizeImportUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 4000) return;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return;
    url.hash = "";
    return url.href.length <= 4000 ? url.href : undefined;
  } catch { return; }
}
export function mapImportRecords(workflow: Workflow, result: unknown, existing: Iterable<string>, linkedIds: Iterable<string> = []) {
  if (!object(result) || result.isError === true) throw new Error("Remote tool reported failure.");
  const source = pointer(result.structuredContent, workflow.recordsPath);
  if (!Array.isArray(source) || source.length > 500) throw new Error("Expected a structured record array of at most 500 entries.");
  const urls = new Set(existing);
  const remoteIds = new Set(linkedIds);
  const records: Candidate[] = [];
  let invalid = 0, duplicates = 0;
  for (const [index, row] of source.entries()) {
    const remoteId = workflow.remoteIdPath ? remoteIdentifier(pointer(row, workflow.remoteIdPath)) : undefined;
    if (workflow.remoteIdPath && !remoteId) { invalid++; continue; }
    if (remoteId && remoteIds.has(remoteId)) { duplicates++; continue; }
    const company = pointer(row, workflow.fields.company);
    const role = pointer(row, workflow.fields.role);
    const url = normalizeImportUrl(pointer(row, workflow.fields.url));
    const notes = workflow.fields.notes ? pointer(row, workflow.fields.notes) ?? "" : "";
    const status = workflow.fields.status ? pointer(row, workflow.fields.status) : "saved";
    if (typeof company !== "string" || !company.trim() || company.length > 500 ||
      typeof role !== "string" || !role.trim() || role.length > 500 || !url ||
      typeof notes !== "string" || notes.length > 50000 || typeof status !== "string" || !statuses.has(status)) {
      invalid++; continue;
    }
    if (urls.has(url)) { duplicates++; continue; }
    urls.add(url);
    if (remoteId) remoteIds.add(remoteId);
    records.push({ index, ...(remoteId ? { remoteId } : {}), company: company.trim(), role: role.trim(), url, notes, status });
  }
  return { records, invalid, duplicates };
}

export function createMcpImports(
  db: DatabaseSync,
  connections: ReturnType<typeof createConnections>,
  getJobs: (profileId: string) => { jobs: { url: string }[] },
  saveJob: (raw: unknown, profileId: string) => unknown,
  links: ReturnType<typeof createMcpLinks>,
) {
  const previews = new Map<string, Preview>();
  const pending = new Set<string>();
  const ajv = new Ajv();
  function requireConnection(profileId: string, id: string) {
    if (connections.listConnections(profileId).find((item) => item.id === id)?.connectorId !== "mcp")
      throw new Error("MCP connection not found.");
  }
  function getMcpImport(profileId: string, id: string) {
    requireConnection(profileId, id);
    const row = db.prepare("SELECT config_json FROM connection_import_workflows WHERE connection_id=?").get(id) as { config_json: string } | undefined;
    return row ? parseImportWorkflow(JSON.parse(row.config_json)) : null;
  }
  async function validateTool(profileId: string, id: string, workflow: Workflow) {
    const tool = (await connections.listConnectionTools(profileId, id)).find((item) => item.name === workflow.tool && item.access === "read");
    if (!tool || !ajv.compile(tool.inputSchema as AnySchema)(workflow.args)) throw new Error("Approved read tool or valid arguments required.");
  }
  async function saveMcpImport(profileId: string, id: string, raw: unknown) {
    requireConnection(profileId, id);
    if (pending.has(id)) throw new Error("Import preview in progress.");
    const workflow = parseImportWorkflow(raw);
    await validateTool(profileId, id, workflow);
    requireConnection(profileId, id);
    if (pending.has(id)) throw new Error("Import preview in progress.");
    links.assertMappingMutable(profileId, id, getMcpImport(profileId, id), workflow);
    db.prepare("INSERT INTO connection_import_workflows VALUES(?,?) ON CONFLICT(connection_id) DO UPDATE SET config_json=excluded.config_json").run(id, JSON.stringify(workflow));
    for (const [key, preview] of previews) if (preview.connectionId === id) previews.delete(key);
    return workflow;
  }
  function existingUrls(profileId: string) {
    return new Set(getJobs(profileId).jobs.map((job) => normalizeImportUrl(job.url)).filter((url): url is string => !!url));
  }
  function prune() {
    for (const [key, preview] of previews) if (preview.expires <= Date.now()) previews.delete(key);
  }
  async function previewMcpImport(profileId: string, id: string) {
    const workflow = getMcpImport(profileId, id);
    if (!workflow || pending.has(id)) throw new Error("Save a workflow first or wait for the current preview.");
    pending.add(id);
    try {
      await validateTool(profileId, id, workflow);
      const result = await connections.callConnectionTool(profileId, id, workflow.tool, workflow.args);
      if (JSON.stringify(getMcpImport(profileId, id)) !== JSON.stringify(workflow)) throw new Error("Workflow changed.");
      const mapped = mapImportRecords(workflow, result, existingUrls(profileId), links.listMcpLinks(profileId, id).map((row) => row.remoteId));
      if (JSON.stringify(mapped.records).length > 2 * 1024 * 1024) throw new Error("Import preview too large.");
      prune();
      for (const [key, preview] of previews) if (preview.connectionId === id) previews.delete(key);
      if (previews.size >= 20) throw new Error("Too many active import previews.");
      const previewId = randomUUID();
      previews.set(previewId, { owner: profileId, connectionId: id, config: JSON.stringify(workflow), expires: Date.now() + 300000, records: mapped.records });
      return { previewId, ...mapped };
    } finally { pending.delete(id); }
  }
  function executeMcpImport(profileId: string, id: string, raw: unknown) {
    const workflow = getMcpImport(profileId, id);
    prune();
    if (!object(raw) || typeof raw.previewId !== "string" || !Array.isArray(raw.indices) ||
      !raw.indices.length || raw.indices.length > 500 || raw.indices.some((index) => !Number.isInteger(index)))
      throw new Error("Select reviewed records.");
    const preview = previews.get(raw.previewId);
    if (!preview || preview.owner !== profileId || preview.connectionId !== id || preview.config !== JSON.stringify(workflow))
      throw new Error("Import preview expired or changed.");
    const indices = new Set(raw.indices);
    const selected = preview.records.filter((record) => indices.has(record.index));
    if (selected.length !== indices.size) throw new Error("Unknown preview record.");
    previews.delete(raw.previewId);
    const runId = randomUUID();
    db.prepare("INSERT INTO connection_transfer_runs(id,connection_id,direction,status,started_at) VALUES(?,?,'import','running',?)").run(runId, id, new Date().toISOString());
    let imported = 0, skipped = 0;
    try {
      const urls = existingUrls(profileId);
      const remoteIds = new Set(links.listMcpLinks(profileId, id).map((row) => row.remoteId));
      for (const { remoteId, company, role, url, notes, status } of selected) {
        if (urls.has(url) || (remoteId && remoteIds.has(remoteId))) { skipped++; continue; }
        const applicationId = randomUUID();
        const job = { id: applicationId, company, role, url, notes, status, createdAt: new Date().toISOString() };
        if (remoteId) {
          db.exec("BEGIN IMMEDIATE");
          try {
            db.prepare("INSERT INTO applications(profile_id,id,company,role,url,status,created_at,notes,revision) VALUES(?,?,?,?,?,?,?,?,1)")
              .run(profileId, applicationId, company, role, url, status, job.createdAt, notes);
            links.insertLink(profileId, id, applicationId, remoteId, "import", job);
            db.exec("COMMIT");
          } catch (error) { db.exec("ROLLBACK"); throw error; }
          remoteIds.add(remoteId);
        } else saveJob({ revision: 0, job }, profileId);
        urls.add(url);
        imported++;
      }
      const result = { imported, skipped };
      db.prepare("UPDATE connection_transfer_runs SET status='completed',finished_at=?,result_json=? WHERE id=?").run(new Date().toISOString(), JSON.stringify(result), runId);
      return result;
    } catch (error) {
      db.prepare("UPDATE connection_transfer_runs SET status='failed',finished_at=?,result_json=? WHERE id=?").run(new Date().toISOString(), JSON.stringify({ imported, skipped }), runId);
      throw error;
    }
  }
  return { getMcpImport, saveMcpImport, previewMcpImport, executeMcpImport };
}
