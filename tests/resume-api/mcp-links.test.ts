import { describe, expect, it } from "vitest";
import { remoteIdentifier, validRemotePointer, baselineHash } from "../../packages/resume-api/src/database/repositories/mcp-links.ts";
import { mapImportRecords, parseImportWorkflow } from "../../packages/resume-api/src/database/repositories/mcp-import.ts";
describe("MCP record identity", () => {
  it("accepts stable strings and safe integer IDs", () => {
    expect(remoteIdentifier("rec-1")).toBe("rec-1");
    expect(remoteIdentifier(42)).toBe("42");
    for (const invalid of [null, {}, "", " ", 1.2, Number.MAX_SAFE_INTEGER + 1, "a\n"]) expect(remoteIdentifier(invalid)).toBeUndefined();
    expect(validRemotePointer("/record/id")).toBe(true);
    expect(validRemotePointer("/bad~2")).toBe(false);
    expect(baselineHash({ id: "x" })).toHaveLength(64);
  });
  it("skips linked and duplicate remote IDs even if URLs differ", () => {
    const workflow = parseImportWorkflow({ tool: "list", args: {}, recordsPath: "/records", fields: { company: "/company", role: "/role", url: "/url" }, remoteIdPath: "/id" });
    const row = { company: "Example", role: "Engineer" };
    const result = mapImportRecords(workflow, { structuredContent: { records: [
      { ...row, id: "linked", url: "https://example.com/1" },
      { ...row, id: "new", url: "https://example.com/2" },
      { ...row, id: "new", url: "https://example.com/3" },
      { ...row, url: "https://example.com/4" },
    ] } }, [], ["linked"]);
    expect(result.records.map((record) => record.remoteId)).toEqual(["new"]);
    expect(result.duplicates).toBe(2);
    expect(result.invalid).toBe(1);
  });
});
