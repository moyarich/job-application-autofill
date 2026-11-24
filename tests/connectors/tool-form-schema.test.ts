import { describe, expect, it } from "vitest";
import { buildToolArguments, describeToolForm, type ToolDraft } from "../../packages/job-application-autofill/src/pages/connections/tool-form-schema.ts";

describe("MCP tool argument forms", () => {
  const schema = {
    type: "object",
    properties: {
      query: { type: "string", minLength: 1 },
      count: { type: "integer", minimum: 1 },
      includeArchived: { type: "boolean" },
      sort: { type: "string", enum: ["newest", "oldest"] },
    },
    required: ["query"],
  };
  it("preserves primitive types and omits unset optional fields", () => {
    const fields = describeToolForm(schema)!;
    expect(buildToolArguments(fields, { query: "engineer" })).toEqual({ query: "engineer" });
    expect(buildToolArguments(fields, { query: "engineer", count: "3", includeArchived: "false", sort: "1" })).toEqual({
      query: "engineer", count: 3, includeArchived: false, sort: "oldest",
    });
  });
  it("rejects missing required values, bad numbers and invalid choices", () => {
    const fields = describeToolForm(schema)!;
    const drafts: ToolDraft[] = [{}, { query: "" }, { query: "x", count: "0" }, { query: "x", count: "1.5" }, { query: "x", sort: "99" }];
    for (const draft of drafts)
      expect(() => buildToolArguments(fields, draft)).toThrow();
  });
  it("falls back for nested objects, arrays, references and complex constraints", () => {
    for (const property of [{ type: "array" }, { type: "object" }, { $ref: "#/$defs/value" }, { type: "string", pattern: "^x" }])
      expect(describeToolForm({ type: "object", properties: { value: property } })).toBeNull();
  });
  it("handles unusual property names without prototype mutation", () => {
    const fields = describeToolForm({ type: "object", properties: JSON.parse('{"__proto__":{"type":"string"}}') })!;
    const args = buildToolArguments(fields, JSON.parse('{"__proto__":"value"}'));
    expect(Object.hasOwn(args, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(args)).toBe(Object.prototype);
  });
});
