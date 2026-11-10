import { describe, expect, it } from "vitest";
import { extractEmploymentHistory } from "@moyarich/resume";
describe("employment history", () => {
  it("supports inline companies, titles and numeric dates", () => {
    expect(
      extractEmploymentHistory(
        "Employment History\nSoftware Engineer | Acme Inc | 01/2022 to Current\n- Built APIs",
      ),
    ).toEqual([
      {
        company: "Acme Inc",
        jobTitle: "Software Engineer",
        location: "",
        startDate: "2022-01",
        endDate: null,
        isCurrent: true,
        description: "- Built APIs",
      },
    ]);
  });
});
