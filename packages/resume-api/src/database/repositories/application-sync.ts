import { createHash, randomUUID } from "node:crypto";
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

export type ChangeState =
  | "unchanged"
  | "local_changed"
  | "remote_changed"
  | "conflict"
  | "converged"
  | "diverged"
  | "remote_missing";

/** Compare each side to its own baseline; never infer a winner from timestamps. */
export function classifyChange(
  baselineLocal: string,
  baselineRemote: string,
  currentLocal: string,
  currentRemote: string | null,
): ChangeState {
  if (currentRemote === null) return "remote_missing";
  const localChanged = baselineLocal !== currentLocal;
  const remoteChanged = baselineRemote !== currentRemote;
  if (currentLocal === currentRemote)
    return localChanged || remoteChanged ? "converged" : "unchanged";
  if (localChanged && remoteChanged) return "conflict";
  if (localChanged) return "local_changed";
  if (remoteChanged) return "remote_changed";
  return "diverged";
}

export function createApplicationSync(
  db: DatabaseSync,
  connections: ReturnType<typeof createConnections>,
  getJobs: (profileId: string) => { jobs: Job[] },
  saveJob: (raw: unknown, profileId: string) => unknown,
) {
  const running = new Set<string>();
  const hash = (values: unknown[]) =>
    createHash("sha256").update(JSON.stringify(values)).digest("hex");
  const localHash = (job: Job) =>
    hash(keys.map((key) => key === "url" ? normalizedUrl(job.url) : job[key]));
  const remoteHash = (record: RemoteRecord, mapping: Mapping) =>
    hash(keys.map((key) => key === "url"
      ? normalizedUrl(record.fields[mapping.fields.url])
      : record.fields[mapping.fields[key]] ?? ""));
  function linkedRemote(id: string, mapping: Mapping, remoteId: string) {
    return db.prepare(
      "SELECT application_id FROM connection_record_links WHERE connection_id=? AND base_id=? AND table_id=? AND remote_id=?",
    ).get(id, mapping.baseId, mapping.tableId, remoteId);
  }
  function linkedLocal(id: string, mapping: Mapping, jobId: string) {
    return db.prepare(
      "SELECT remote_id FROM connection_record_links WHERE connection_id=? AND base_id=? AND table_id=? AND application_id=?",
    ).get(id, mapping.baseId, mapping.tableId, jobId);
  }
  function link(profileId: string, id: string, mapping: Mapping, job: Job, record: RemoteRecord) {
    if (!/^rec[A-Za-z0-9]+$/.test(record.id))
      throw new Error("Invalid Airtable record identity.");
    db.prepare(
      "INSERT INTO connection_record_links VALUES(?,?,?,?,?,?,?,?,?)",
    ).run(id, profileId, job.id, mapping.baseId, mapping.tableId, record.id,
      localHash(job), remoteHash(record, mapping), new Date().toISOString());
  }
  function listConnectionHistory(profileId: string, id: string) {
    requireConnection(profileId, id);
    return db.prepare(
      "SELECT id,direction,status,started_at AS startedAt,finished_at AS finishedAt,result_json AS resultJson FROM connection_transfer_runs WHERE connection_id=? ORDER BY started_at DESC,id DESC LIMIT 50",
    ).all(id).map(({ resultJson, ...row }) => ({
      ...row,
      result: typeof resultJson === "string" ? JSON.parse(resultJson) as unknown : null,
    }));
  }
  function listConnectionRecordLinks(profileId: string, id: string) {
    const mapping = getConnectionMapping(profileId, id);
    if (!mapping) return [];
    return db.prepare(
      "SELECT application_id AS applicationId,remote_id AS remoteId,linked_at AS linkedAt FROM connection_record_links WHERE connection_id=? AND profile_id=? AND base_id=? AND table_id=? ORDER BY application_id",
    ).all(id, profileId, mapping.baseId, mapping.tableId);
  }
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
    const previous = getConnectionMapping(profileId, id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(mapping) &&
      db.prepare("SELECT 1 FROM connection_record_links WHERE connection_id=? LIMIT 1").get(id)) {
      throw new Error("Create a separate connection to change a mapping with linked records.");
    }
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
  async function reviewConnectionChanges(profileId: string, id: string) {
    const mapping = getConnectionMapping(profileId, id);
    if (!mapping) throw new Error("Save a field mapping first.");
    if (running.has(id)) throw new Error("Transfer in progress.");
    running.add(id);
    try {
      const remote = await records(profileId, id, mapping);
      requireConnection(profileId, id);
      const jobs = new Map(getJobs(profileId).jobs.map((job) => [job.id, job]));
      const remoteById = new Map<string, RemoteRecord>();
      for (const record of remote) {
        if (!record || !/^rec[A-Za-z0-9]+$/.test(record.id) ||
          !record.fields || typeof record.fields !== "object" ||
          Array.isArray(record.fields) || remoteById.has(record.id)) {
          throw new Error("Invalid or duplicate Airtable record.");
        }
        remoteById.set(record.id, record);
      }
      const links = db.prepare(
        "SELECT application_id AS applicationId,remote_id AS remoteId,local_hash AS localHash,remote_hash AS remoteHash FROM connection_record_links WHERE connection_id=? AND profile_id=? AND base_id=? AND table_id=? ORDER BY application_id",
      ).all(id, profileId, mapping.baseId, mapping.tableId) as {
        applicationId: string;
        remoteId: string;
        localHash: string;
        remoteHash: string;
      }[];
      const changes = links.flatMap((link) => {
        const job = jobs.get(link.applicationId);
        if (!job) return [];
        const record = remoteById.get(link.remoteId);
        const currentLocal = localHash(job);
        const currentRemote = record ? remoteHash(record, mapping) : null;
        const state = classifyChange(link.localHash, link.remoteHash, currentLocal, currentRemote);
        return [{
          applicationId: job.id,
          remoteId: link.remoteId,
          state,
          local: Object.fromEntries(keys.map((key) => [key, job[key]])),
          remote: record ? Object.fromEntries(keys.map((key) => [key, record.fields[mapping.fields[key]] ?? ""])) : null,
        }];
      });
      return { checkedAt: new Date().toISOString(), changes };
    } finally {
      running.delete(id);
    }
  }

  async function transfer<T>(profileId: string, id: string, direction: "import" | "export", action: () => Promise<T>) {
    requireConnection(profileId, id);
    if (running.has(id)) throw new Error("Transfer in progress.");
    running.add(id);
    const runId = randomUUID();
    try {
      db.prepare("INSERT INTO connection_transfer_runs(id,connection_id,direction,status,started_at) VALUES(?,?,?,'running',?)")
        .run(runId, id, direction, new Date().toISOString());
      try {
        const result = await action();
        db.prepare("UPDATE connection_transfer_runs SET status='completed',finished_at=?,result_json=? WHERE id=?")
          .run(new Date().toISOString(), JSON.stringify(result), runId);
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
  function importConnectionApplications(profileId: string, id: string) {
    return transfer(profileId, id, "import", async () => {
      const mapping = getConnectionMapping(profileId, id);
      if (!mapping) throw new Error("Save a field mapping first.");
      const remote = await records(profileId, id, mapping);
      requireConnection(profileId, id);
      const existing = new Set(getJobs(profileId).jobs.map((job) => normalizedUrl(job.url)));
      let imported = 0;
      let skipped = 0;
      for (const record of remote) {
        if (!/^rec[A-Za-z0-9]+$/.test(record.id) || linkedRemote(id, mapping, record.id)) {
          skipped++;
          continue;
        }
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
        const job = { id: randomUUID(), company, role, url, notes,
          status: "saved", createdAt: new Date().toISOString() };
        saveJob({ revision: 0, job }, profileId);
        link(profileId, id, mapping, job, record);
        existing.add(url);
        imported++;
      }
      return { imported, skipped };
    });
  }
  function exportConnectionApplication(profileId: string, id: string, raw: unknown) {
    return transfer(profileId, id, "export", async () => {
      if (!requireConnection(profileId, id).allowWrites) throw new Error("Connection is read only.");
      const mapping = getConnectionMapping(profileId, id);
      if (!mapping) throw new Error("Save a field mapping first.");
      const jobId = (raw as { jobId?: unknown } | null)?.jobId;
      const job = getJobs(profileId).jobs.find((item) => item.id === jobId);
      const url = normalizedUrl(job?.url);
      if (!job || !url) throw new Error("Choose an application with a valid HTTPS URL.");
      if (linkedLocal(id, mapping, job.id)) return { created: false, reason: "already linked" };
      const remote = await records(profileId, id, mapping);
      if (remote.some((record) => normalizedUrl(record.fields[mapping.fields.url]) === url))
        return { created: false, reason: "already exists" };
      const fields = Object.fromEntries(keys.map((key) => [mapping.fields[key], key === "url" ? url : job[key]]));
      const record = await connections.callConnectionTool(profileId, id, "create_record", {
        baseId: mapping.baseId, tableId: mapping.tableId, fields,
      }) as RemoteRecord;
      requireConnection(profileId, id);
      link(profileId, id, mapping, job, record);
      return { created: true };
    });
  }
  return { getConnectionMapping, saveConnectionMapping, importConnectionApplications, exportConnectionApplication, listConnectionHistory, listConnectionRecordLinks, reviewConnectionChanges };
}
