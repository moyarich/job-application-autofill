import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";


import { openStore } from "../../packages/resume-api/store.ts";

const example = JSON.parse(readFileSync(new URL("../../packages/resume/src/resume-schema/resume.example.json", import.meta.url), "utf8"));
const job = { id:"e8796d4c-828e-4634-aa60-ab39bc95e241",company:"Example",
  role:"Engineer",url:"https://example.com/jobs/1",status:"saved",
  createdAt:"2026-11-05T12:00:00.000Z",notes:"Initial note" };

describe("SQLite application data persistence", () => {
  
  
  it("does not save partial data when validation fails", () => {
    const db=openStore(":memory:");
    try {
      db.saveResumeContent({revision:0,profile:example,contactId:null});
      db.updateJobRecord({revision:0,job});
      expect(()=>db.updateJobRecord({revision:1,job:{...job,status:"invalid"}})).toThrow(/status/);
      expect(()=>db.saveResumeContent({revision:1,profile:{bad:true},contactId:null})).toThrow();
      expect(db.getResumeContent()).toMatchObject({revision:1,profile:example});
      expect(db.getJobList()).toMatchObject({revision:1,job});
    } finally { db.close(); }
  });
  
});
