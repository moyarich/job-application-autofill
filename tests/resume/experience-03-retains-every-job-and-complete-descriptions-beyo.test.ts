import { describe, expect, it } from "vitest";
import { extractProfile, extractEmploymentHistory } from "@moyarich/resume";
describe("employment history",()=>{
  
  
  it("retains every job and complete descriptions beyond former caps",()=>{
    const text=["Career History",...Array.from({length:45},(_,i)=>[
      "Company "+i+" Technologies",
      "Software Engineer",
      "January "+(2025-i)+" - December "+(2025-i),
      "● "+("Built and deployed reliable services ".repeat(150))+"END-"+i
    ]).flat(),"Education"].join("\n");
    const jobs=extractEmploymentHistory(text);
    expect(jobs).toHaveLength(45);
    expect(jobs.at(-1)?.company).toBe("Company 44 Technologies");
    expect(jobs[0].description.length).toBeGreaterThan(4000);
    expect(jobs[0].description).toContain("END-0");
    expect(jobs.at(-1)?.description).toContain("END-44");
  });
  
  
  
});
