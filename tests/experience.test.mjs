import { describe, expect, it } from "vitest";
import { extractProfile, extractEmploymentHistory } from "@moyarich/extract-resume";
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
  it("does not guess undated jobs",()=>expect(extractEmploymentHistory("Skills\nAWS\nEducation\nUniversity")).toEqual([]));
});
