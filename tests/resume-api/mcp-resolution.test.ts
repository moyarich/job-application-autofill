import { describe, expect, it } from "vitest";
import { parseUpdateWorkflow, buildUpdateArguments } from "../../packages/resume-api/src/database/repositories/mcp-resolution.ts";
import { classifyVerified } from "../../packages/resume-api/src/database/repositories/mcp-change-review.ts";
import { baselineHash } from "../../packages/resume-api/src/database/repositories/mcp-links.ts";
describe("MCP resolution", () => {
  const values = { company: "Example", role: "Engineer", url: "https://example.com/job" };
  const config = { tool: "update", idArgument: "recordId", fields: { company: "company", role: "role", url: "url" }, constants: { table: "jobs" } };
  it("maps only explicitly reviewed fields and the stable remote ID", () => {
    expect(buildUpdateArguments(parseUpdateWorkflow(config), "r1", values)).toEqual({ table: "jobs", recordId: "r1", ...values });
    expect(() => buildUpdateArguments(parseUpdateWorkflow(config), "r1", { ...values, notes: "extra" })).toThrow();
    expect(() => parseUpdateWorkflow({ ...config, constants: { recordId: "other" } })).toThrow();
  });
  it("classifies changes using independent verified hashes", () => {
    const hash = baselineHash(values);
    expect(classifyVerified(values, values, hash, hash)).toBe("unchanged");
    expect(classifyVerified(values, { ...values, role: "New" }, hash, hash)).toBe("remote_changed");
    expect(classifyVerified({ ...values, role: "New" }, values, hash, hash)).toBe("local_changed");
  });
});
