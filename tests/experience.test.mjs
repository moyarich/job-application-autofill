import { describe, expect, it } from "vitest";
import { extractProfile, extractEmploymentHistory } from "@moyarich/resume";
describe("employment history",()=>{
  it("extracts distinct dated jobs and stops at education",()=>{
    const text=["Ada Lovelace","Professional Experience","Example Technologies","Senior Software Engineer","June 2021 – Present","• Built AWS tools","Example Solutions","Software Engineer","March 2018 - May 2021","• Developed APIs","Education","University","2014 - 2018"].join("\n");
    expect(extractEmploymentHistory(text)).toEqual([
      {company:"Example Technologies",jobTitle:"Senior Software Engineer",location:"",startDate:"2021-06",endDate:null,isCurrent:true,description:"Built AWS tools"},
      {company:"Example Solutions",jobTitle:"Software Engineer",location:"",startDate:"2018-03",endDate:"2021-05",isCurrent:false,description:"Developed APIs"}
    ]);
    expect(extractProfile(text).experience).toHaveLength(2);
  });
  it("supports inline companies, titles and numeric dates",()=>{
    expect(extractEmploymentHistory("Employment History\nSoftware Engineer | Acme Inc | 01/2022 to Current\n- Built APIs")).toEqual([
      {company:"Acme Inc",jobTitle:"Software Engineer",location:"",startDate:"2022-01",endDate:null,isCurrent:true,description:"Built APIs"}]);
  });
  it("retains every job and complete descriptions beyond former caps",()=>{
    const text=["Career History",...Array.from({length:45},(_,i)=>[
      "Company "+i+" Technologies",
      "Software Engineer",
      "January "+(2025-i)+" - December "+(2025-i),
      "● "+("Built and deployed reliable services ".repeat(150))+"END-"+i
    ]).flat(),"Education"].join("\n");
    const jobs=extractEmploymentHistory(text);
    expect(jobs).toHaveLength(45);
    expect(jobs.at(-1).company).toBe("Company 44 Technologies");
    expect(jobs[0].description.length).toBeGreaterThan(4000);
    expect(jobs[0].description).toContain("END-0");
    expect(jobs.at(-1).description).toContain("END-44");
  });
  it("recognizes more history headings and expanded date separators",()=>{
    const jobs=extractEmploymentHistory("Professional Background\nExample Technologies\nPrincipal Engineer\n2020-01—2024-02\n• Led platform engineering\nEducation");
    expect(jobs).toHaveLength(1);
    expect(jobs[0].description).toBe("Led platform engineering");
  });
  it("parses dates preceding a title and preserves grouped promotions",()=>{
    const datesFirst=extractEmploymentHistory([
      "Work Experience","January 2022 - Present","Senior Engineer","Acme Inc","• Built APIs","Education"
    ].join("\n"));
    expect(datesFirst).toMatchObject([{company:"Acme Inc",jobTitle:"Senior Engineer",description:"Built APIs"}]);
    const promotions=extractEmploymentHistory([
      "Career History","Acme Inc","Senior Engineer","2021 - Present","• Led projects",
      "Software Engineer","2018 - 2020","• Developed integrations","Education"
    ].join("\n"));
    expect(promotions).toHaveLength(2);
    expect(promotions[1]).toMatchObject({company:"Acme Inc",jobTitle:"Software Engineer",description:"Developed integrations"});
  });
  it("does not guess undated jobs",()=>expect(extractEmploymentHistory("Skills\nAWS\nEducation\nUniversity")).toEqual([]));
});
