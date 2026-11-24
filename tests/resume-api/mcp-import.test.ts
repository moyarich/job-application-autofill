import { describe, expect, it } from "vitest";
import { mapImportRecords, parseImportWorkflow, pointer } from "../../packages/resume-api/src/database/repositories/mcp-import.ts";

describe("MCP application import mapping", () => {
  const workflow = parseImportWorkflow({ tool: "list", args: {}, recordsPath: "/records", fields: { company: "/company", role: "/title", url: "/url" } });
  it("maps structured records and skips invalid or duplicate URLs", () => {
    const job = { company: "Example", title: "Engineer", url: "https://example.com/jobs/1#details" };
    const result = mapImportRecords(workflow, { structuredContent: { records: [job, { ...job, url: "https://example.com/jobs/1" }, { ...job, url: "http://example.com/jobs/2" }, { ...job, url: "https://example.com/jobs/3" }] } }, ["https://example.com/jobs/3"]);
    expect(result).toEqual({ records: [{ index: 0, company: "Example", role: "Engineer", url: "https://example.com/jobs/1", notes: "", status: "saved" }], invalid: 1, duplicates: 2 });
  });
  it("rejects text-only and error results", () => {
    expect(() => mapImportRecords(workflow, { content: [] }, [])).toThrow();
    expect(() => mapImportRecords(workflow, { isError: true }, [])).toThrow();
  });
  it("uses escaped JSON pointers and rejects inherited properties", () => {
    expect(pointer({ "a/b": { "~": 3 } }, "/a~1b/~0")).toBe(3);
    expect(pointer({}, "/constructor")).toBeUndefined();
    expect(() => pointer({}, "/bad~2")).toThrow();
  });
});
