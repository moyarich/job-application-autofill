import { describe, expect, it } from "vitest";
import { validateResume } from "../../packages/resume/src/resume-schema/validate.ts";
import { extractProfile, decodeUpload } from "@moyarich/resume";

describe("resume parser", () => {
  
  
});

describe("structured PDF reading order", () => {
  it("retains sections, wrapped skills and company/date/title employment", () => {
    const profile = extractProfile([
      "Ada Lovelace", "ada@example.com", "Professional Summary", "Builds reliable", "cloud software.",
      "Technical Skills:", "Programming Languages: Python,", "HTML, CSS", "Application Development: React,", "REST APIs, WordPress",
      "Professional Experience:", "Independent Software Consultant Aug. 2011 – Present", "Senior Full-Stack Developer",
      "● Develop applications", "Acme Web Services", "Industries, Customer Engineering Oct 2022 – July 2025",
      "Solution Developer", "● Built APIs", "Education:", "Example University - Chicago, IL",
      "Bachelor of Science: Computer Information Systems", "Certification", "AWS Certified Solutions Architect – Associate",
      "Community Leadership and Technical Writing", "● Community administrator"
    ].join("\r\n"));
    expect(validateResume(JSON.parse(JSON.stringify(profile)))).toEqual(profile);
    expect(profile.summary).toBe("Builds reliable cloud software.");
    expect(profile.skills).toEqual(["Python", "HTML", "CSS", "React", "REST APIs", "WordPress"]);
    expect(profile.experience).toMatchObject([
      {company:"Independent Software Consultant", jobTitle:"Senior Full-Stack Developer", startDate:"2011-08", endDate:null, description:"Develop applications"},
      {company:"Acme Web Services", jobTitle:"Solution Developer", startDate:"2022-10", endDate:"2025-07", description:"Built APIs"}
    ]);
    expect(profile.education[0]).toMatchObject({institution:"Example University", degree:"Bachelor of Science", fieldOfStudy:"Computer Information Systems", location:"Chicago, IL"});
    expect(profile.certifications).toHaveLength(1);
    expect(profile.certifications[0].name).toBe("AWS Certified Solutions Architect – Associate");
  });
});
