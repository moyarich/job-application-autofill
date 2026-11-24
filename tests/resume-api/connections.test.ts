import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { createConnections } from "../../packages/resume-api/src/database/repositories/connections.ts";
import { initializeDatabase } from "../../packages/resume-api/src/database/schema.ts";

afterEach(() => vi.unstubAllEnvs());

function fixture() {
  vi.stubEnv("MOYA_CONNECTOR_KEY", "ab".repeat(32));
  const db = new DatabaseSync(":memory:");
  initializeDatabase(db);
  for (const id of ["first", "second"]) {
    db.prepare("INSERT INTO profiles VALUES(?,?,?)").run(id, id, "2026-11-24");
  }
  return { db, store: createConnections(db, (id) => id) };
}

describe("persistent connections", () => {
  it("encrypts tokens and isolates connection metadata by profile", async () => {
    const { db, store } = fixture();
    try {
      const row = store.addConnection("first", {
        connectorId: "airtable",
        name: "Jobs",
        accessToken: "secret-token",
      });
      expect(row.allowWrites).toBe(false);
      expect(JSON.stringify(row)).not.toContain("secret-token");
      expect(JSON.stringify(db.prepare("SELECT * FROM connections").get())).not.toContain("secret-token");
      expect(store.listConnections("second")).toEqual([]);
      await expect(store.listConnectionTools("second", row.id)).rejects.toThrow("not found");
      expect(() => store.removeConnection("second", row.id)).toThrow("not found");
      expect((await store.listConnectionTools("first", row.id)).every((tool) => tool.access === "read")).toBe(true);
      store.removeConnection("first", row.id);
      expect(store.listConnections("first")).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("fails closed without an encryption key", () => {
    const { db, store } = fixture();
    try {
      vi.stubEnv("MOYA_CONNECTOR_KEY", "");
      expect(() => store.addConnection("first", {
        connectorId: "airtable",
        name: "Jobs",
        accessToken: "secret-token",
      })).toThrow("MOYA_CONNECTOR_KEY");
      expect(store.listConnections("first")).toEqual([]);
    } finally {
      db.close();
    }
  });
});
