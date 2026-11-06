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
  it("persists schema-valid resume JSON and tracked jobs after closing and reopening", () => {
    const dir=mkdtempSync(join(tmpdir(),"moya-sqlite-"));
    const path=join(dir,"data.sqlite");
    try {
      const first=openStore(path);
      expect(first.getSnapshot()).toMatchObject({revision:0,profile:null,jobs:[]});
      expect(first.saveSnapshot({revision:0,profile:example,jobs:[job]})).toEqual({revision:1});
      first.close();
      const reopened=openStore(path);
      expect(reopened.getSnapshot()).toMatchObject({revision:1,profile:example,jobs:[job]});
      expect(reopened.saveSnapshot({revision:1,profile:example,jobs:[{...job,status:"interview",notes:"Updated"}]})).toEqual({revision:2});
      expect(reopened.getSnapshot().jobs[0].notes).toBe("Updated");
      reopened.close();
    } finally { rmSync(dir,{recursive:true,force:true}); }
  });
  
  
  
});
