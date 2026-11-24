import { describe, expect, it } from "vitest";
import { parseWorkflow, buildWorkflowArguments } from "../../packages/resume-api/src/database/repositories/mcp-workflows.ts";
describe("MCP application workflows", () => {
  it("sends only explicitly mapped fields and constants", () => {
    const workflow = parseWorkflow({ tool: "create", fields: { title: "role" }, constants: { table: "jobs" } });
    expect(buildWorkflowArguments(workflow, { id: "1", company: "Example", role: "Engineer", url: "https://example.com/job", status: "saved", createdAt: "2026-11-24", notes: "private" })).toEqual({ title: "Engineer", table: "jobs" });
  });
  it("rejects unapproved source fields and overlapping constants", () => {
    expect(() => parseWorkflow({ tool: "create", fields: { secret: "resume" }, constants: {} })).toThrow();
    expect(() => parseWorkflow({ tool: "create", fields: { title: "role" }, constants: { title: "fixed" } })).toThrow();
  });
});
