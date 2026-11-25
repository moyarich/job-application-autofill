import { describe, expect, it } from "vitest";
import { planMcpSync, MCP_SYNC_LIMIT } from "../../packages/resume-api/src/database/repositories/mcp-sync.ts";
import type { McpChangeState } from "../../packages/resume-api/src/database/repositories/mcp-change-review.ts";

function change(state: McpChangeState, verifiedBaseline = true, applicationId = state as string) {
  return { applicationId, reviewToken: "token-" + applicationId, state, verifiedBaseline };
}
describe("MCP synchronization planning", () => {
  it("only applies verified one-sided or converged changes", () => {
    const changes = [change("unchanged"), change("remote_changed"), change("local_changed"), change("converged"), change("conflict"), change("baseline_unverified"), change("not_returned"), change("invalid_remote"), change("remote_changed", false, "unverified-import")];
    const plan = planMcpSync(changes, true);
    expect(plan.actions.map((item) => item.choice)).toEqual(["remote", "local", "accept"]);
    expect(plan.unchanged).toBe(1);
    expect(plan.deferred).toBe(5);
  });
  it("does not push remote writes without batch permission", () => {
    expect(planMcpSync([change("local_changed"), change("remote_changed")], false).actions.map((item) => item.choice)).toEqual(["remote"]);
  });
  it("bounds each batch and defers remaining records", () => {
    const plan = planMcpSync(Array.from({ length: 25 }, (_, index) => change("remote_changed", true, String(index))), false);
    expect(plan.actions).toHaveLength(MCP_SYNC_LIMIT);
    expect(plan.deferred).toBe(5);
  });
});
