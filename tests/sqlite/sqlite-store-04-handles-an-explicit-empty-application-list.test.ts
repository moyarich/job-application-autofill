import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";


import { openStore } from "../../packages/resume-api/store.ts";

const example = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json", import.meta.url), "utf8"));
const job = { id:"e8796d4c-828e-4634-aa60-ab39bc95e241",company:"Example",
  role:"Engineer",url:"https://example.com/jobs/1",status:"saved",
  createdAt:"2026-11-05T12:00:00.000Z",notes:"Initial note" };

describe("SQLite application data persistence", () => {
  
  
  
  it("handles an explicit empty application list", () => {
    const db=openStore(":memory:");
    try {
      db.saveResumeContent({revision:0,profile:example,contactId:null});
      db.saveJobList({revision:0,jobs:[job]});
      db.saveJobList({revision:1,jobs:[]});
      expect(db.getJobList().jobs).toEqual([]);
    } finally { db.close(); }
  });
});
