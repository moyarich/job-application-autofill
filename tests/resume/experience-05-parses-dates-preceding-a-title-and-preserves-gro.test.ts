import { describe, expect, it } from "vitest";
import { extractEmploymentHistory } from "@moyarich/resume";
describe("employment history",()=>{
  
  
  
  
  it("parses dates preceding a title and preserves grouped promotions",()=>{
    const datesFirst=extractEmploymentHistory([
      "Work Experience","January 2022 - Present","Senior Engineer","Acme Inc","• Built APIs","Education"
    ].join("\n"));
    expect(datesFirst).toMatchObject([{company:"Acme Inc",jobTitle:"Senior Engineer",description:"- Built APIs"}]);
    const promotions=extractEmploymentHistory([
      "Career History","Acme Inc","Senior Engineer","2021 - Present","• Led projects",
      "Software Engineer","2018 - 2020","• Developed integrations","Education"
    ].join("\n"));
    expect(promotions).toHaveLength(2);
    expect(promotions[1]).toMatchObject({company:"Acme Inc",jobTitle:"Software Engineer",description:"- Developed integrations"});
  });
  
});
