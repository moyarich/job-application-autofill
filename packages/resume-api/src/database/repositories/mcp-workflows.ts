import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { createConnections } from "./connections.ts";
import Ajv, { type AnySchema } from "ajv";

export const applicationFields = ["id", "company", "role", "url", "status", "createdAt", "notes"] as const;
type Field = (typeof applicationFields)[number];
type Job = Record<Field, string>;
type Workflow = { tool: string; fields: Record<string, Field>; constants: Record<string, unknown> };

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function parseWorkflow(raw: unknown): Workflow {
  if (!object(raw) || Object.keys(raw).some((key) => !["tool", "fields", "constants"].includes(key)) ||
    typeof raw.tool !== "string" || !/^[A-Za-z0-9_.-]{1,128}$/.test(raw.tool) ||
    !object(raw.fields) || !object(raw.constants)) throw new Error("Invalid workflow.");
  const fields = Object.entries(raw.fields);
  const constants = Object.entries(raw.constants);
  if (!fields.length || fields.length + constants.length > 50 ||
    fields.some(([key, field]) => !key || key.length > 128 || !applicationFields.includes(field as Field)) ||
    constants.some(([key]) => !key || key.length > 128 || Object.hasOwn(raw.fields as object, key)) ||
    JSON.stringify(raw.constants).length > 16000) throw new Error("Invalid workflow arguments.");
  return { tool: raw.tool, fields: Object.fromEntries(fields) as Workflow["fields"], constants: Object.fromEntries(constants) };
}
export function buildWorkflowArguments(workflow: Workflow, job: Job) {
  return Object.fromEntries([
    ...Object.entries(workflow.constants),
    ...Object.entries(workflow.fields).map(([name, field]) => [name, job[field]]),
  ]);
}
export function createMcpWorkflows(
  db: DatabaseSync,
  connections: ReturnType<typeof createConnections>,
  getJobs: (profileId: string) => { jobs: Job[] },
) {
  const running = new Set<string>();
  const ajv = new Ajv();
  function requireConnection(profileId: string, id: string) {
    const row = connections.listConnections(profileId).find((item) => item.id === id);
    if (row?.connectorId !== "mcp" || !row.allowWrites) throw new Error("A writable MCP connection is required.");
  }
  function getMcpWorkflow(profileId: string, id: string) {
    requireConnection(profileId, id);
    const row = db.prepare("SELECT config_json FROM connection_workflows WHERE connection_id=?").get(id) as { config_json: string } | undefined;
    return row ? parseWorkflow(JSON.parse(row.config_json)) : null;
  }
  async function toolFor(profileId: string, id: string, workflow: Workflow) {
    requireConnection(profileId, id);
    const tool = (await connections.listConnectionTools(profileId, id)).find((item) => item.name === workflow.tool && item.access === "write");
    if (!tool) throw new Error("Approved write tool unavailable.");
    const properties = tool.inputSchema.properties;
    if (tool.inputSchema.type !== "object" || !object(properties) ||
      [...Object.keys(workflow.fields), ...Object.keys(workflow.constants)].some((name) => !Object.hasOwn(properties, name)))
      throw new Error("Workflow arguments must match declared tool properties.");
    return tool;
  }
  async function saveMcpWorkflow(profileId: string, id: string, raw: unknown) {
    requireConnection(profileId, id);
    if (running.has(id)) throw new Error("Workflow running.");
    const workflow = parseWorkflow(raw);
    await toolFor(profileId, id, workflow);
    requireConnection(profileId, id);
    if (running.has(id)) throw new Error("Workflow running.");
    db.prepare("INSERT INTO connection_workflows VALUES(?,?) ON CONFLICT(connection_id) DO UPDATE SET config_json=excluded.config_json")
      .run(id, JSON.stringify(workflow));
    return workflow;
  }
  async function previewMcpWorkflow(profileId: string, id: string, jobId: unknown) {
    const workflow = getMcpWorkflow(profileId, id);
    if (!workflow) throw new Error("Save a workflow first.");
    const tool = await toolFor(profileId, id, workflow);
    const job = getJobs(profileId).jobs.find((item) => item.id === jobId);
    if (!job) throw new Error("Application not found.");
    const args = buildWorkflowArguments(workflow, job);
    if (!ajv.compile(tool.inputSchema as AnySchema)(args)) throw new Error("Mapped arguments do not satisfy the tool schema.");
    const reviewToken = createHash("sha256").update(JSON.stringify([id, job.id, workflow, tool.inputSchema, args])).digest("hex");
    return { tool: workflow.tool, args, reviewToken };
  }
  async function executeMcpWorkflow(profileId: string, id: string, raw: unknown) {
    requireConnection(profileId, id);
    if (!object(raw) || typeof raw.jobId !== "string" || typeof raw.reviewToken !== "string") throw new Error("Review the transfer first.");
    if (running.has(id)) throw new Error("Workflow running.");
    running.add(id);
    const runId = randomUUID();
    try {
      const preview = await previewMcpWorkflow(profileId, id, raw.jobId);
      if (preview.reviewToken !== raw.reviewToken) throw new Error("Workflow or application changed. Review again.");
      db.prepare("INSERT INTO connection_transfer_runs(id,connection_id,direction,status,started_at) VALUES(?,?,'export','running',?)")
        .run(runId, id, new Date().toISOString());
      try {
        const result = await connections.callConnectionTool(profileId, id, preview.tool, preview.args);
        if (object(result) && result.isError === true) throw new Error("Remote tool reported failure.");
        db.prepare("UPDATE connection_transfer_runs SET status='completed',finished_at=?,result_json=? WHERE id=?")
          .run(new Date().toISOString(), JSON.stringify({ executed: true }), runId);
        return result;
      } catch (error) {
        db.prepare("UPDATE connection_transfer_runs SET status='failed',finished_at=? WHERE id=?")
          .run(new Date().toISOString(), runId);
        throw error;
      }
    } finally {
      running.delete(id);
    }
  }
  return { getMcpWorkflow, saveMcpWorkflow, previewMcpWorkflow, executeMcpWorkflow };
}
