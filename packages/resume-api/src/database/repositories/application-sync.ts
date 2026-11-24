import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { createConnections } from "./connections.ts";

const keys = ["company", "role", "url", "notes"] as const;
type Field = (typeof keys)[number];
const statuses = ["saved", "in_progress", "ready_for_review", "submitted", "interview", "rejected"] as const;
type Status = (typeof statuses)[number];
type StatusMapping = { fieldId: string; values: Record<Status, string> };

export function parseStatusMapping(raw: unknown, used: string[]): StatusMapping {
  const value = raw as Partial<StatusMapping> | null;
  if (!value || typeof value.fieldId !== "string" ||
    !/^fld[A-Za-z0-9]+$/.test(value.fieldId) || used.includes(value.fieldId) ||
    !value.values || statuses.some((status) =>
      typeof value.values?.[status] !== "string" ||
      !value.values[status].trim() || value.values[status].length > 500) ||
    new Set(statuses.map((status) => value.values?.[status])).size !== statuses.length)
    throw new Error("Map each application status to a distinct Airtable value.");
  return {
    fieldId: value.fieldId,
    values: Object.fromEntries(statuses.map((status) => [status, value.values![status]])) as StatusMapping["values"],
  };
}

export function decodeStatus(mapping: StatusMapping, value: unknown): Status | undefined {
  return statuses.find((status) => mapping.values[status] === value);
}

function encodeStatus(mapping: StatusMapping, status: unknown): string {
  if (!statuses.includes(status as Status)) throw new Error("Unknown local application status.");
  return mapping.values[status as Status];
}
type Mapping = {
  baseId: string;
  tableId: string;
  fields: Record<Field, string>;
  status?: StatusMapping;
};
type Job = { id: string; company: string; role: string; url: string; notes: string; status?: string };
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
    ...(value.status === undefined ? {} : { status: parseStatusMapping(value.status, Object.values(value.fields)) }),
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

/** Only propagate changes from a previously matching baseline. */
export function automaticChoice(state: ChangeState, allowWrites: boolean): "local" | "remote" | null {
  if (state === "converged" || state === "remote_changed") return "remote";
  if (state === "local_changed" && allowWrites) return "local";
  return null;
}

export function createApplicationSync(
  db: DatabaseSync,
  connections: ReturnType<typeof createConnections>,
  getJobs: (profileId: string) => { jobs: Job[]; revisions?: Record<string, number> },
  saveJob: (raw: unknown, profileId: string) => unknown,
) {
  const running = new Set<string>();
  const syncing = new Set<string>();
  const hash = (values: unknown[]) =>
    createHash("sha256").update(JSON.stringify(values)).digest("hex");
  const localHash = (job: Job, mapping: Mapping) =>
    hash([
      ...keys.map((key) => key === "url" ? normalizedUrl(job.url) : job[key]),
      ...(mapping.status ? [encodeStatus(mapping.status, job.status)] : []),
    ]);
  const remoteHash = (record: RemoteRecord, mapping: Mapping) =>
    hash([
      ...keys.map((key) => key === "url"
        ? normalizedUrl(record.fields[mapping.fields.url])
        : record.fields[mapping.fields[key]] ?? ""),
      ...(mapping.status ? [record.fields[mapping.status.fieldId] ?? null] : []),
    ]);
  function outgoingFields(job: Job, mapping: Mapping, url: string) {
    return {
      ...Object.fromEntries(keys.map((key) => [mapping.fields[key], key === "url" ? url : job[key]])),
      ...(mapping.status ? { [mapping.status.fieldId]: encodeStatus(mapping.status, job.status) } : {}),
    };
  }
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
      localHash(job, mapping), remoteHash(record, mapping), new Date().toISOString());
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
    if (running.has(id) || syncing.has(id)) throw new Error("Transfer in progress.");
    const mapping = parseMapping(raw);
    const schema = await connections.callConnectionTool(profileId, id, "get_schema", { baseId: mapping.baseId }) as {
      tables: { id: string; fields: { id: string; type: string; options?: { choices?: { name: string }[] } }[] }[];
    };
    const table = schema.tables.find((item) => item.id === mapping.tableId);
    const textTypes = ["singleLineText", "multilineText", "url"];
    if (!table || keys.some((key) => !table.fields.some((field) =>
      field.id === mapping.fields[key] &&
      (key === "url" ? textTypes.includes(field.type) : ["singleLineText", "multilineText"].includes(field.type)),
    ))) throw new Error("Mapped fields must be compatible text or URL fields.");
    if (mapping.status) {
      const status = mapping.status;
      const field = table.fields.find((item) => item.id === status.fieldId);
      if (!field || !["singleSelect", "singleLineText"].includes(field.type) ||
        (field.type === "singleSelect" && Object.values(status.values).some((label) =>
          !field.options?.choices?.some((choice) => choice.name === label))))
        throw new Error("Choose an existing single-select option or text value for each status.");
    }
    requireConnection(profileId, id);
    if (running.has(id) || syncing.has(id)) throw new Error("Transfer in progress.");
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
  async function reviewConnectionChanges(profileId: string, id: string, internal = false) {
    const mapping = getConnectionMapping(profileId, id);
    if (!mapping) throw new Error("Save a field mapping first.");
    if (running.has(id) || (!internal && syncing.has(id))) throw new Error("Transfer in progress.");
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
        const currentLocal = localHash(job, mapping);
        const currentRemote = record ? remoteHash(record, mapping) : null;
        const state = classifyChange(link.localHash, link.remoteHash, currentLocal, currentRemote);
        return [{
          applicationId: job.id,
          remoteId: link.remoteId,
          state,
          matchingBaseline: link.localHash === link.remoteHash,
          reviewToken: hash([id, mapping, job.id, link.remoteId, link.localHash, link.remoteHash, currentLocal, currentRemote]),
          local: { ...Object.fromEntries(keys.map((key) => [key, job[key]])),
            ...(mapping.status ? { status: job.status ?? "", statusLabel: encodeStatus(mapping.status, job.status) } : {}) },
          remote: record ? { ...Object.fromEntries(keys.map((key) => [key, record.fields[mapping.fields[key]] ?? ""])),
            ...(mapping.status ? { status: decodeStatus(mapping.status, record.fields[mapping.status.fieldId]) ?? "Unmapped", statusLabel: record.fields[mapping.status.fieldId] ?? "" } : {}) } : null,
        }];
      });
      return { checkedAt: new Date().toISOString(), changes };
    } finally {
      running.delete(id);
    }
  }

  function resolveConnectionChange(profileId: string, id: string, raw: unknown, internal = false) {
    const input = raw as { applicationId?: unknown; reviewToken?: unknown; choice?: unknown } | null;
    if (!input || typeof input.applicationId !== "string" ||
      typeof input.reviewToken !== "string" || !/^[a-f0-9]{64}$/.test(input.reviewToken) ||
      (input.choice !== "local" && input.choice !== "remote")) {
      throw new Error("Choose a reviewed application and resolution.");
    }
    const { applicationId, reviewToken, choice } = input;
    return transfer(profileId, id, choice === "local" ? "export" : "import", async () => {
      if (choice === "local" && !requireConnection(profileId, id).allowWrites)
        throw new Error("Connection is read only.");
      const mapping = getConnectionMapping(profileId, id);
      if (!mapping) throw new Error("Save a field mapping first.");
      const link = db.prepare(
        "SELECT remote_id AS remoteId,local_hash AS localHash,remote_hash AS remoteHash FROM connection_record_links WHERE connection_id=? AND profile_id=? AND base_id=? AND table_id=? AND application_id=?",
      ).get(id, profileId, mapping.baseId, mapping.tableId, applicationId) as {
        remoteId: string; localHash: string; remoteHash: string;
      } | undefined;
      if (!link) throw new Error("Linked application not found.");
      const record = await connections.callConnectionTool(profileId, id, "get_record", {
        baseId: mapping.baseId, tableId: mapping.tableId, recordId: link.remoteId,
      }) as RemoteRecord;
      requireConnection(profileId, id);
      if (!record || record.id !== link.remoteId || !record.fields ||
        typeof record.fields !== "object" || Array.isArray(record.fields))
        throw new Error("Invalid Airtable record.");
      const snapshot = getJobs(profileId);
      const job = snapshot.jobs.find((item) => item.id === applicationId);
      if (!job) throw new Error("Application not found.");
      const currentLocal = localHash(job, mapping);
      const currentRemote = remoteHash(record, mapping);
      if (reviewToken !== hash([id, mapping, job.id, link.remoteId, link.localHash, link.remoteHash, currentLocal, currentRemote]))
        throw new Error("Records changed since review. Check changes again.");
      const values = choice === "local" ? job : {
        company: record.fields[mapping.fields.company],
        role: record.fields[mapping.fields.role],
        url: record.fields[mapping.fields.url],
        notes: record.fields[mapping.fields.notes] ?? "",
      };
      const { company, role, notes } = values;
      const url = normalizedUrl(values.url);
      if (!url || typeof company !== "string" || !company.trim() || company.length > 500 ||
        typeof role !== "string" || !role.trim() || role.length > 500 ||
        typeof notes !== "string" || notes.length > 50000)
        throw new Error("Chosen version contains invalid application fields.");
      const status = mapping.status
        ? choice === "local" ? job.status : decodeStatus(mapping.status, record.fields[mapping.status.fieldId])
        : undefined;
      if (mapping.status && !statuses.includes(status as Status))
        throw new Error("Chosen Airtable status has no local mapping.");
      const nextJob = { ...job, company, role, url, notes, ...(mapping.status ? { status } : {}) };
      let nextLocal = currentLocal;
      let nextRemote = currentRemote;
      if (choice === "remote" && currentLocal !== currentRemote) {
        if (snapshot.jobs.some((other) => other.id !== job.id && normalizedUrl(other.url) === url))
          throw new Error("Another local application uses this URL.");
        const revision = snapshot.revisions?.[job.id];
        if (!Number.isSafeInteger(revision)) throw new Error("Application revision unavailable.");
        saveJob({ revision, job: nextJob }, profileId);
        nextLocal = localHash(nextJob, mapping);
      } else if (choice === "local" && currentLocal !== currentRemote) {
        const fields = outgoingFields(nextJob, mapping, url);
        const updated = await connections.callConnectionTool(profileId, id, "update_record", {
          baseId: mapping.baseId, tableId: mapping.tableId, recordId: link.remoteId, fields,
        }) as RemoteRecord;
        if (!updated || updated.id !== link.remoteId || !updated.fields ||
          remoteHash(updated, mapping) !== localHash(nextJob, mapping))
          throw new Error("Airtable update could not be verified. Review again.");
        nextRemote = remoteHash(updated, mapping);
      }
      requireConnection(profileId, id);
      const result = db.prepare(
        "UPDATE connection_record_links SET local_hash=?,remote_hash=? WHERE connection_id=? AND profile_id=? AND base_id=? AND table_id=? AND application_id=? AND remote_id=? AND local_hash=? AND remote_hash=?",
      ).run(nextLocal, nextRemote, id, profileId, mapping.baseId, mapping.tableId, applicationId, link.remoteId, link.localHash, link.remoteHash);
      if (!result.changes) throw new Error("Record association changed. Review again.");
      return { resolved: true, choice, applicationId };
    }, internal);
  }

  async function transfer<T>(profileId: string, id: string, direction: "import" | "export", action: () => Promise<T>, internal = false) {
    requireConnection(profileId, id);
    if (running.has(id) || (!internal && syncing.has(id))) throw new Error("Transfer in progress.");
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
        const status = mapping.status ? decodeStatus(mapping.status, fields[mapping.status.fieldId]) : "saved";
        if (!status) {
          skipped++;
          continue;
        }
        const job = { id: randomUUID(), company, role, url, notes,
          status, createdAt: new Date().toISOString() };
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
      const fields = outgoingFields(job, mapping, url);
      const record = await connections.callConnectionTool(profileId, id, "create_record", {
        baseId: mapping.baseId, tableId: mapping.tableId, fields,
      }) as RemoteRecord;
      requireConnection(profileId, id);
      link(profileId, id, mapping, job, record);
      return { created: true };
    });
  }
  async function syncConnectionApplications(profileId: string, id: string) {
    const connection = requireConnection(profileId, id);
    if (running.has(id) || syncing.has(id)) throw new Error("Transfer in progress.");
    syncing.add(id);
    try {
      const report = await reviewConnectionChanges(profileId, id, true);
      const result = { checked: report.changes.length, pulled: 0, pushed: 0, converged: 0, unchanged: 0, needsReview: 0, deferred: 0, failed: 0 };
      let attempts = 0;
      for (const change of report.changes) {
        if (change.state === "unchanged") { result.unchanged++; continue; }
        const choice = change.matchingBaseline || change.state === "converged"
          ? automaticChoice(change.state, connection.allowWrites) : null;
        if (!choice) { result.needsReview++; continue; }
        if (attempts >= 20) { result.deferred++; continue; }
        attempts++;
        try {
          await resolveConnectionChange(profileId, id, { applicationId: change.applicationId, reviewToken: change.reviewToken, choice }, true);
          if (change.state === "converged") result.converged++;
          else if (choice === "local") result.pushed++;
          else result.pulled++;
        } catch {
          result.failed++;
          // Stop after an uncertain write or stale snapshot; re-review before continuing.
          result.deferred += report.changes.slice(report.changes.indexOf(change) + 1).length;
          break;
        }
      }
      return result;
    } finally {
      syncing.delete(id);
    }
  }
  return { syncConnectionApplications, getConnectionMapping, saveConnectionMapping, importConnectionApplications, exportConnectionApplication, listConnectionHistory, listConnectionRecordLinks, reviewConnectionChanges, resolveConnectionChange };
}
