import { createMcpSyncHistory, type SyncSummary } from "./mcp-sync-history.ts";
import { planMcpSync } from "./mcp-sync.ts";
import type { DatabaseSync } from "node:sqlite";
import Ajv, { type AnySchema } from "ajv";
import { baselineHash, type createMcpLinks } from "./mcp-links.ts";
import { mappedValues, type Values, type ReviewJob, type createMcpChangeReview } from "./mcp-change-review.ts";
import type { createMcpImports } from "./mcp-import.ts";
import type { createConnections } from "./connections.ts";

const fields = ["company", "role", "url", "notes", "status"] as const;
type Field = (typeof fields)[number];
type UpdateWorkflow = { tool: string; idArgument: string; fields: Record<string, Field>; constants: Record<string, unknown> };
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function parseUpdateWorkflow(raw: unknown): UpdateWorkflow {
  if (!object(raw) || Object.keys(raw).some((key) => !["tool", "idArgument", "fields", "constants"].includes(key)) ||
      typeof raw.tool !== "string" || !/^[A-Za-z0-9_.-]{1,128}$/.test(raw.tool) ||
      typeof raw.idArgument !== "string" || !raw.idArgument || raw.idArgument.length > 128 ||
      !object(raw.fields) || !object(raw.constants)) throw new Error("Invalid update workflow.");
  const entries = Object.entries(raw.fields);
  const constants = Object.entries(raw.constants);
  const names = [raw.idArgument, ...entries.map(([name]) => name), ...constants.map(([name]) => name)];
  if (!entries.length || names.length > 50 || new Set(names).size !== names.length ||
      names.some((name) => !name || name.length > 128) ||
      entries.some(([, field]) => !fields.includes(field as Field)) ||
      JSON.stringify(raw.constants).length > 16000) throw new Error("Invalid update arguments.");
  return { tool: raw.tool, idArgument: raw.idArgument, fields: Object.fromEntries(entries) as UpdateWorkflow["fields"], constants: Object.fromEntries(constants) };
}
export function buildUpdateArguments(workflow: UpdateWorkflow, remoteId: string, values: Values) {
  if (Object.values(workflow.fields).some((field) => !Object.hasOwn(values, field)) ||
      Object.keys(values).some((field) => !Object.values(workflow.fields).includes(field as Field)))
    throw new Error("Update must map exactly the reviewed fields.");
  return Object.fromEntries([...Object.entries(workflow.constants), [workflow.idArgument, remoteId], ...Object.entries(workflow.fields).map(([name, field]) => [name, values[field]])]);
}
export function createMcpResolution(
  db: DatabaseSync,
  connections: ReturnType<typeof createConnections>,
  imports: ReturnType<typeof createMcpImports>,
  links: ReturnType<typeof createMcpLinks>,
  review: ReturnType<typeof createMcpChangeReview>,
  getJobs: (profileId: string) => { jobs: ReviewJob[]; revisions: Record<string, number> },
) {
  const running = new Set<string>();
  const activeSync = new Set<string>();
  const history = createMcpSyncHistory(db);
  const ajv = new Ajv();
  function requireOwner(profileId: string, id: string) { links.reviewLinks(profileId, id); }
  function getMcpUpdateWorkflow(profileId: string, id: string) {
    requireOwner(profileId, id);
    const row = db.prepare("SELECT config_json FROM connection_mcp_update_workflows WHERE connection_id=?").get(id) as { config_json: string } | undefined;
    return row ? parseUpdateWorkflow(JSON.parse(row.config_json)) : null;
  }
  async function writeTool(profileId: string, id: string, workflow: UpdateWorkflow) {
    if (!connections.listConnections(profileId).find((row) => row.id === id && row.allowWrites)) throw new Error("Writable connection required.");
    const tool = (await connections.listConnectionTools(profileId, id)).find((item) => item.name === workflow.tool && item.access === "write");
    if (!tool || tool.inputSchema.type !== "object" || !object(tool.inputSchema.properties) ||
        [workflow.idArgument, ...Object.keys(workflow.fields), ...Object.keys(workflow.constants)].some((key) => !Object.hasOwn(tool.inputSchema.properties as object, key)))
      throw new Error("Approved update tool and declared arguments required.");
    return tool;
  }
  async function saveMcpUpdateWorkflow(profileId: string, id: string, raw: unknown) {
    requireOwner(profileId, id);
    if (running.has(id)) throw new Error("Resolution in progress.");
    const workflow = parseUpdateWorkflow(raw);
    await writeTool(profileId, id, workflow);
    requireOwner(profileId, id);
    if (running.has(id)) throw new Error("Resolution in progress.");
    db.prepare("INSERT INTO connection_mcp_update_workflows VALUES(?,?) ON CONFLICT(connection_id) DO UPDATE SET config_json=excluded.config_json").run(id, JSON.stringify(workflow));
    return workflow;
  }
  async function applyResolution(profileId: string, id: string, raw: unknown) {
    requireOwner(profileId, id);
    if (!object(raw) || typeof raw.applicationId !== "string" || typeof raw.reviewToken !== "string" ||
        !["local", "remote", "accept"].includes(String(raw.choice))) throw new Error("Select a reviewed resolution.");
    {
      const mapping = imports.getMcpImport(profileId, id);
      if (!mapping) throw new Error("Import mapping required.");
      const update = raw.choice === "local" ? getMcpUpdateWorkflow(profileId, id) : null;
      const tool = update ? await writeTool(profileId, id, update) : null;
      const change = (await review.reviewMcpChanges(profileId, id)).changes.find((row) => row.applicationId === raw.applicationId);
      if (!change?.remote || change.reviewToken !== raw.reviewToken) throw new Error("Review is stale or remote record unavailable.");
      const desired = raw.choice === "remote" ? change.remote : change.local;
      if (raw.choice === "accept" && baselineHash(change.local) !== baselineHash(change.remote)) throw new Error("Values must match.");
      if (raw.choice === "local") {
        if (!update || !tool || baselineHash(update) !== raw.updateToken) throw new Error("Review the configured update workflow again.");
        const args = buildUpdateArguments(update, change.remoteId, desired);
        if (!ajv.compile(tool.inputSchema as AnySchema)(args)) throw new Error("Update arguments do not match the schema.");
        const result = await connections.callConnectionTool(profileId, id, update.tool, args);
        if (object(result) && result.isError === true) throw new Error("Remote update failed.");
        const verified = (await review.reviewMcpChanges(profileId, id)).changes.find((row) => row.applicationId === change.applicationId);
        if (!verified?.remote || verified.remoteId !== change.remoteId || verified.revision !== change.revision ||
            baselineHash(verified.remote) !== baselineHash(desired) || baselineHash(verified.local) !== baselineHash(desired))
          throw new Error("Remote outcome not verified. Review again before retrying.");
      }
      if (JSON.stringify(imports.getMcpImport(profileId, id)) !== JSON.stringify(mapping)) throw new Error("Mapping changed.");
      const current = getJobs(profileId);
      const job = current.jobs.find((row) => row.id === change.applicationId);
      if (!job || current.revisions[job.id] !== change.revision || baselineHash(mappedValues(mapping, job)) !== baselineHash(change.local))
        throw new Error("Application changed. Review again.");
      db.exec("BEGIN IMMEDIATE");
      try {
        if (raw.choice === "remote") {
          const updated = db.prepare("UPDATE applications SET company=?,role=?,url=?,notes=?,status=?,revision=revision+1 WHERE profile_id=? AND id=? AND revision=?")
            .run(desired.company, desired.role, desired.url, desired.notes ?? job.notes, desired.status ?? job.status, profileId, job.id, change.revision);
          if (!updated.changes) throw new Error("Application changed.");
        }
        const hash = baselineHash(desired);
        db.prepare("INSERT INTO connection_mcp_baselines VALUES(?,?,?,?,?) ON CONFLICT(connection_id,remote_id) DO UPDATE SET local_hash=excluded.local_hash,remote_hash=excluded.remote_hash,verified_at=excluded.verified_at")
          .run(id, change.remoteId, hash, hash, new Date().toISOString());
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
      return { resolved: true };
    }
  }
  async function resolveMcpChange(profileId: string, id: string, raw: unknown) {
    if (running.has(id)) throw new Error("Resolution in progress.");
    running.add(id);
    try { return await applyResolution(profileId, id, raw); }
    finally { running.delete(id); }
  }
  function getMcpUpdateConfig(profileId: string, id: string) {
    const workflow = getMcpUpdateWorkflow(profileId, id);
    return { workflow, updateToken: workflow ? baselineHash(workflow) : null };
  }
  function listMcpSyncHistory(profileId: string, id: string) {
    requireOwner(profileId, id);
    return history.list(id, activeSync.has(id));
  }
  async function syncMcpApplications(profileId: string, id: string, raw: unknown) {
    requireOwner(profileId, id);
    if (!object(raw) || raw.confirm !== true) throw new Error("Confirm synchronization first.");
    if (running.has(id)) throw new Error("Resolution or synchronization in progress.");
    running.add(id);
    activeSync.add(id);
    let runId: string | undefined;
    let result: SyncSummary | null = null;
    let phase: "review_failed" | "run_failed" = "review_failed";
    try {
      runId = history.start(id);
      const config = getMcpUpdateConfig(profileId, id);
      // A saved write mapping is not permission to invoke it in a batch.
      const allowRemoteWrites = !!config.updateToken && raw.updateToken === config.updateToken;
      const report = await review.reviewMcpChanges(profileId, id);
      const plan = planMcpSync(report.changes, allowRemoteWrites);
      phase = "run_failed";
      result = { checked: report.changes.length, unchanged: plan.unchanged, applied: 0, deferred: plan.deferred + plan.actions.length, failed: 0, stopped: false };
      history.progress(id, runId, result);
      for (const item of plan.actions) {
        try {
          await applyResolution(profileId, id, { applicationId: item.applicationId, reviewToken: item.reviewToken, choice: item.choice, updateToken: config.updateToken });
          result.applied++;
          result.deferred--;
        } catch {
          // The write may have happened. Stop instead of retrying or continuing a possibly stale batch.
          result.failed++;
          result.deferred--;
          result.stopped = true;
          break;
        }
        history.progress(id, runId, result);
      }
      history.finish(id, runId, result, result.failed ? "resolution_failed" : null);
      return result;
    } catch (error) {
      if (runId) {
        if (result) result.stopped = true;
        history.finish(id, runId, result, phase);
      }
      throw error;
    } finally { activeSync.delete(id); running.delete(id); }
  }
  return { getMcpUpdateConfig, saveMcpUpdateWorkflow, resolveMcpChange, syncMcpApplications, listMcpSyncHistory };
}
