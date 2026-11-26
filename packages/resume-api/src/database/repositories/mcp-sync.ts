import type { McpChangeState } from "./mcp-change-review.ts";

type Change = { applicationId: string; reviewToken: string; state: McpChangeState; verifiedBaseline: boolean };
type Action = { applicationId: string; reviewToken: string; choice: "local" | "remote" | "accept" };
export const MCP_SYNC_LIMIT = 20;

/** Only verified baselines may drive automatic decisions. */
export function planMcpSync(changes: Change[], allowRemoteWrites: boolean) {
  const actions: Action[] = [];
  let unchanged = 0, deferred = 0;
  for (const change of changes) {
    if (change.state === "unchanged") { unchanged++; continue; }
    const choice = !change.verifiedBaseline ? null :
      change.state === "remote_changed" ? "remote" :
      change.state === "local_changed" && allowRemoteWrites ? "local" :
      change.state === "converged" ? "accept" : null;
    if (!choice || actions.length >= MCP_SYNC_LIMIT) { deferred++; continue; }
    actions.push({ applicationId: change.applicationId, reviewToken: change.reviewToken, choice });
  }
  return { actions, unchanged, deferred };
}
