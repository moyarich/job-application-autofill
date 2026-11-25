import { describe, expect, it } from "vitest";
import { classifyImported, mappedValues } from "../../packages/resume-api/src/database/repositories/mcp-change-review.ts";
import { parseImportWorkflow } from "../../packages/resume-api/src/database/repositories/mcp-import.ts";
import { baselineHash } from "../../packages/resume-api/src/database/repositories/mcp-links.ts";
describe("MCP imported record change review", () => {
  const workflow = parseImportWorkflow({ tool: "list", args: {}, recordsPath: "/records", fields: { company: "/company", role: "/role", url: "/url" }, remoteIdPath: "/id" });
  const job = { id: "local", company: "Example", role: "Engineer", url: "https://example.com/job", notes: "", status: "saved", createdAt: "2026-11-25" };
  const baseline = baselineHash(job);
  const original = mappedValues(workflow, job);
  it("classifies unchanged, one-sided, conflicting and matching edits", () => {
    expect(classifyImported(workflow, job, original, baseline)).toBe("unchanged");
    expect(classifyImported(workflow, { ...job, role: "Local" }, original, baseline)).toBe("local_changed");
    expect(classifyImported(workflow, job, { ...original, role: "Remote" }, baseline)).toBe("remote_changed");
    expect(classifyImported(workflow, { ...job, role: "Local" }, { ...original, role: "Remote" }, baseline)).toBe("conflict");
    expect(classifyImported(workflow, { ...job, role: "New" }, { ...original, role: "New" }, baseline)).toBe("converged");
  });
  it("ignores fields that are not mapped", () => {
    expect(classifyImported(workflow, { ...job, notes: "private", status: "interview" }, original, baseline)).toBe("unchanged");
  });
});
