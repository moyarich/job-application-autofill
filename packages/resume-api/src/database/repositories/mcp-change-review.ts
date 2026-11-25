import { baselineHash, remoteIdentifier, type createMcpLinks } from "./mcp-links.ts";
import { mapImportRecords, normalizeImportUrl, pointer, readImportRows, type ImportWorkflow, type createMcpImports } from "./mcp-import.ts";
import type { createConnections } from "./connections.ts";

export type ReviewJob = { id: string; company: string; role: string; url: string; notes: string; status: string; createdAt: string };
export type Values = { company: string; role: string; url: string; notes?: string; status?: string };
export type McpChangeState = "unchanged" | "local_changed" | "remote_changed" | "conflict" | "converged" | "baseline_unverified" | "not_returned" | "invalid_remote";

export function mappedValues(workflow: ImportWorkflow, job: Pick<ReviewJob, "company" | "role" | "url" | "notes" | "status">): Values {
  return {
    company: job.company.trim(), role: job.role.trim(), url: normalizeImportUrl(job.url) ?? job.url,
    ...(workflow.fields.notes ? { notes: job.notes } : {}),
    ...(workflow.fields.status ? { status: job.status } : {}),
  };
}

/** Import baselines include immutable local identity and creation time.
 * Reconstruct the imported shape, excluding unmapped fields from comparison.
 */
export function classifyImported(workflow: ImportWorkflow, job: ReviewJob, remote: Values, baseline: string): McpChangeState {
  const local = mappedValues(workflow, job);
  const originalShape = (values: Values) => ({
    id: job.id, company: values.company, role: values.role, url: values.url,
    notes: values.notes ?? "", status: values.status ?? "saved", createdAt: job.createdAt,
  });
  const localHash = baselineHash(originalShape(local));
  const remoteHash = baselineHash(originalShape(remote));
  if (localHash === baseline && remoteHash === baseline) return "unchanged";
  if (localHash === remoteHash) return "converged";
  if (localHash === baseline) return "remote_changed";
  if (remoteHash === baseline) return "local_changed";
  return "conflict";
}

export function classifyVerified(local: Values, remote: Values, localBaseline: string, remoteBaseline: string): McpChangeState {
  const l = baselineHash(local), r = baselineHash(remote);
  if (l === localBaseline && r === remoteBaseline) return "unchanged";
  if (l === r) return "converged";
  if (l === localBaseline) return "remote_changed";
  if (r === remoteBaseline) return "local_changed";
  return "conflict";
}

export function createMcpChangeReview(
  connections: ReturnType<typeof createConnections>,
  imports: ReturnType<typeof createMcpImports>,
  links: ReturnType<typeof createMcpLinks>,
  getJobs: (profileId: string) => { jobs: ReviewJob[]; revisions: Record<string, number> },
) {
  const running = new Set<string>();
  async function reviewMcpChanges(profileId: string, id: string) {
    const workflow = imports.getMcpImport(profileId, id);
    if (!workflow?.remoteIdPath) throw new Error("Configure an import workflow with a stable record ID first.");
    if (running.has(id)) throw new Error("Review already in progress.");
    running.add(id);
    try {
      const tool = (await connections.listConnectionTools(profileId, id)).find((item) => item.name === workflow.tool && item.access === "read");
      if (!tool) throw new Error("Approved read tool unavailable.");
      const result = await connections.callConnectionTool(profileId, id, workflow.tool, workflow.args);
      const rows = readImportRows(workflow, result);
      if (JSON.stringify(imports.getMcpImport(profileId, id)) !== JSON.stringify(workflow)) throw new Error("Import mapping changed.");
      const byId = new Map<string, unknown>();
      const ambiguous = new Set<string>();
      for (const row of rows) {
        const remoteId = remoteIdentifier(pointer(row, workflow.remoteIdPath));
        if (!remoteId) continue;
        if (byId.has(remoteId)) ambiguous.add(remoteId);
        else byId.set(remoteId, row);
      }
      const snapshot = getJobs(profileId);
      const jobs = new Map(snapshot.jobs.map((job) => [job.id, job]));
      const changes = links.reviewLinks(profileId, id).flatMap((link) => {
        const job = jobs.get(link.applicationId);
        if (!job) return [];
        const local = mappedValues(workflow, job);
        let remote: Values | null = null;
        let state: McpChangeState;
        if (ambiguous.has(link.remoteId)) state = "invalid_remote";
        else if (!byId.has(link.remoteId)) state = "not_returned";
        else {
          // Map one record at a time: distinct remote IDs may legitimately share a URL.
          const mapped = mapImportRecords({ ...workflow, recordsPath: "/records" }, { structuredContent: { records: [byId.get(link.remoteId)] } }, []);
          if (!mapped.records.length) state = "invalid_remote";
          else {
            remote = mappedValues(workflow, mapped.records[0]);
            state = link.localHash && link.remoteHash ? classifyVerified(local, remote, link.localHash, link.remoteHash) : link.direction === "import" ? classifyImported(workflow, job, remote, link.baselineHash) : "baseline_unverified";
          }
        }
        const reviewToken = baselineHash([profileId, id, workflow, link, snapshot.revisions[job.id], local, remote]);
        return [{ applicationId: link.applicationId, remoteId: link.remoteId, state, local, remote, reviewToken, verifiedBaseline: !!link.localHash && !!link.remoteHash, revision: snapshot.revisions[job.id] }];
      });
      return { checkedAt: new Date().toISOString(), changes };
    } finally { running.delete(id); }
  }
  return { reviewMcpChanges };
}
