import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../../packages/resume-api/store.ts";

const example = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json", import.meta.url), "utf8"));
const job = { id:"e8796d4c-828e-4634-aa60-ab39bc95e241",company:"Example",
  role:"Engineer",url:"https://example.com/jobs/1",status:"saved",
  createdAt:"2026-11-05T12:00:00.000Z",notes:"Initial note" };

describe("SQLite application data persistence", () => {
  
  it("rejects stale revisions without changing saved data", () => {
    const db=openStore(":memory:");
    try {
      db.saveSnapshot({revision:0,profile:example,jobs:[job]});
      expect(()=>db.saveSnapshot({revision:0,profile:example,jobs:[]})).toThrow(/another tab/);
      expect(db.getSnapshot().jobs).toEqual([job]);
    } finally { db.close(); }
  });
  
  
});
