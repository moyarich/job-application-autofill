import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { createConnections } from "./connections.ts";

const keys = ["company", "role", "url", "notes"] as const;
type Field = (typeof keys)[number];
type Mapping = {
  baseId: string;
  tableId: string;
  fields: Record<Field, string>;
};
type Job = { id: string; company: string; role: string; url: string; notes: string };
type RemoteRecord = { id: string; fields: Record<string, unknown> };

export function parseMapping(raw: unknown): Mapping {
  const value = raw as Partial<Mapping> | null;
  if (
    !value ||
    typeof value.baseId !== "string" ||
    !/^app[A-Za-z0-9]+$/.test(value.baseId) ||
    typeof value.tableId !== "string" ||
    !/^tbl[A-Za-z0-9]+$/.test(value.tableId) ||
    !value.fields ||
    keys.some((key) => typeof value.fields?.[key] !== "string" ||
      !/^fld[A-Za-z0-9]+$/.test(value.fields[key])) ||
    new Set(keys.map((key) => value.fields?.[key])).size !== keys.length
  ) throw new Error("Choose distinct Airtable fields for all application fields.");
  return {
    baseId: value.baseId,
    tableId: value.tableId,
    fields: Object.fromEntries(keys.map((key) => [key, value.fields![key]])) as Mapping["fields"],
  };
}

export function normalizedUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

export function createApplicationSync(
  db: DatabaseSync,
  connections: ReturnType<typeof createConnections>,
  getJobs: (profileId: string) => { jobs: Job[] },
  saveJob: (raw: unknown, profileId: string) => unknown,
) {
  const running = new Set<string>();
  function requireConnection(profileId: string, id: string) {
    const connection = connections.listConnections(profileId).find((item) => item.id === id);
    if (connection?.connectorId !== "airtable") throw new Error("Airtable connection not found.");
    return connection;
  }
  function getConnectionMapping(profileId: string, id: string): Mapping | null {
    requireConnection(profileId, id);
    const row = db.prepare("SELECT mapping_json FROM connection_mappings WHERE connection_id=?").get(id) as { mapping_json: string } | undefined;
    return row ? parseMapping(JSON.parse(row.mapping_json)) : null;
  }
  async function saveConnectionMapping(profileId: string, id: string, raw: unknown) {
    requireConnection(profileId, id);
    if (running.has(id)) throw new Error("Transfer in progress.");
    const mapping = parseMapping(raw);
    const schema = await connections.callConnectionTool(profileId, id, "get_schema", { baseId: mapping.baseId }) as {
      tables: { id: string; fields: { id: string; type: string }[] }[];
    };
    const table = schema.tables.find((item) => item.id === mapping.tableId);
    const textTypes = ["singleLineText", "multilineText", "url"];
    if (!table || keys.some((key) => !table.fields.some((field) =>
      field.id === mapping.fields[key] &&
      (key === "url" ? textTypes.includes(field.type) : ["singleLineText", "multilineText"].includes(field.type)),
    ))) throw new Error("Mapped fields must be compatible text or URL fields.");
    requireConnection(profileId, id);
    if (running.has(id)) throw new Error("Transfer in progress.");
    db.prepare("INSERT INTO connection_mappings VALUES(?,?) ON CONFLICT(connection_id) DO UPDATE SET mapping_json=excluded.mapping_json").run(id, JSON.stringify(mapping));
    return mapping;
  }
  async function records(profileId: string, id: string, mapping: Mapping) {
    const result: RemoteRecord[] = [];
    const seen = new Set<string>();
    let offset: string | undefined;
    do {
      const page = await connections.callConnectionTool(profileId, id, "list_records", {
        baseId: mapping.baseId, tableId: mapping.tableId, ...(offset ? { offset } : {}),
      }) as { records: RemoteRecord[]; offset?: string };
      if (!Array.isArray(page.records)) throw new Error("Invalid Airtable record response.");
      result.push(...page.records);
      offset = page.offset;
      if (offset) {
        if (seen.has(offset) || seen.size >= 49) throw new Error("Airtable table exceeds transfer limit.");
        seen.add(offset);
      }
    } while (offset);
    return result;
  }
  async function transfer<T>(id: string, action: () => Promise<T>) {
    if (running.has(id)) throw new Error("Transfer in progress.");
    running.add(id);
    try {
      return await action();
    } finally {
      running.delete(id);
    }
  }
  function importConnectionApplications(profileId: string, id: string) {
    return transfer(id, async () => {
      const mapping = getConnectionMapping(profileId, id);
      if (!mapping) throw new Error("Save a field mapping first.");
      const remote = await records(profileId, id, mapping);
      requireConnection(profileId, id);
      const existing = new Set(getJobs(profileId).jobs.map((job) => normalizedUrl(job.url)));
      let imported = 0;
      let skipped = 0;
      for (const record of remote) {
        const fields = record.fields;
        const url = normalizedUrl(fields[mapping.fields.url]);
        const company = fields[mapping.fields.company];
        const role = fields[mapping.fields.role];
        const notes = fields[mapping.fields.notes] ?? "";
        if (!url || existing.has(url) || typeof company !== "string" ||
          !company.trim() || company.length > 500 || typeof role !== "string" ||
          !role.trim() || role.length > 500 || typeof notes !== "string" || notes.length > 50000) {
          skipped++;
          continue;
        }
        saveJob({ revision: 0, job: { id: randomUUID(), company, role, url, notes,
          status: "saved", createdAt: new Date().toISOString() } }, profileId);
        existing.add(url);
        imported++;
      }
      return { imported, skipped };
    });
  }
  function exportConnectionApplication(profileId: string, id: string, raw: unknown) {
    return transfer(id, async () => {
      if (!requireConnection(profileId, id).allowWrites) throw new Error("Connection is read only.");
      const mapping = getConnectionMapping(profileId, id);
      if (!mapping) throw new Error("Save a field mapping first.");
      const jobId = (raw as { jobId?: unknown } | null)?.jobId;
      const job = getJobs(profileId).jobs.find((item) => item.id === jobId);
      const url = normalizedUrl(job?.url);
      if (!job || !url) throw new Error("Choose an application with a valid HTTPS URL.");
      const remote = await records(profileId, id, mapping);
      if (remote.some((record) => normalizedUrl(record.fields[mapping.fields.url]) === url))
        return { created: false, reason: "already exists" };
      const fields = Object.fromEntries(keys.map((key) => [mapping.fields[key], key === "url" ? url : job[key]]));
      await connections.callConnectionTool(profileId, id, "create_record", {
        baseId: mapping.baseId, tableId: mapping.tableId, fields,
      });
      return { created: true };
    });
  }
  return { getConnectionMapping, saveConnectionMapping, importConnectionApplications, exportConnectionApplication };
}
