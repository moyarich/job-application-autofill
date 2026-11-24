import { describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  createApplicationSync,
  normalizedUrl,
  parseMapping,
} from "../../packages/resume-api/src/database/repositories/application-sync.ts";
import type { createConnections } from "../../packages/resume-api/src/database/repositories/connections.ts";

const mapping = {
  baseId: "app123",
  tableId: "tbl123",
  fields: { company: "fld1", role: "fld2", url: "fld3", notes: "fld4" },
};

describe("application transfer", () => {
  it("validates field identifiers and normalizes HTTPS URLs", () => {
    expect(parseMapping(mapping)).toEqual(mapping);
    expect(() => parseMapping({
      ...mapping,
      fields: { ...mapping.fields, notes: "fld1" },
    })).toThrow();
    expect(normalizedUrl("https://example.com/job#details")).toBe(
      "https://example.com/job",
    );
    expect(normalizedUrl("http://example.com")).toBeNull();
    expect(normalizedUrl("https://user:password@example.com")).toBeNull();
  });

  it("imports new URLs only and skips existing exports", async () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("CREATE TABLE connections(id TEXT PRIMARY KEY); CREATE TABLE applications(profile_id TEXT, id TEXT, PRIMARY KEY(profile_id,id)); CREATE TABLE connection_mappings(connection_id TEXT PRIMARY KEY, mapping_json TEXT)");
      db.exec(readFileSync(new URL("../../packages/resume-api/src/database/tables/connection-transfers.sql", import.meta.url), "utf8"));
      db.exec("INSERT INTO connections VALUES('connection'); INSERT INTO applications VALUES('profile','job')");
      const listConnections = vi.fn(() => [
        { id: "connection", connectorId: "airtable", allowWrites: true },
      ]);
      const callConnectionTool = vi.fn(async () => ({
        records: [
          {
            id: "rec1",
            fields: { fld1: "Company", fld2: "Engineer", fld3: "https://example.com/job", fld4: "" },
          },
        ],
      }));
      const connections = { listConnections, callConnectionTool } as unknown as ReturnType<typeof createConnections>;
      db.prepare("INSERT INTO connection_mappings VALUES(?,?)").run(
        "connection", JSON.stringify(mapping),
      );
      const job = { id: "job", company: "Company", role: "Engineer", url: "https://example.com/job", notes: "" };
      const save = vi.fn();
      const sync = createApplicationSync(db, connections, () => ({ jobs: [job] }), save);
      expect(await sync.importConnectionApplications("profile", "connection")).toEqual({ imported: 0, skipped: 1 });
      expect(save).not.toHaveBeenCalled();
      expect(await sync.exportConnectionApplication("profile", "connection", { jobId: "job" })).toEqual({ created: false, reason: "already exists" });
      expect(callConnectionTool).toHaveBeenCalledTimes(2);
      expect(sync.listConnectionHistory("profile", "connection")).toHaveLength(2);
      expect(sync.listConnectionRecordLinks("profile", "connection")).toEqual([]);
    } finally {
      db.close();
    }
  });
});
