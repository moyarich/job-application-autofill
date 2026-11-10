import { test, expect } from "@playwright/test";
import { fillWorkdayContact } from "../../packages/job-boards/workday/contact/contact.ts";
import { emptyCandidate } from "../../packages/job-application-autofill/src/index.ts";

test("Workday uses saved extended contact fields without overwriting existing fields", async ({
  page,
}) => {
  await page.setContent(
    [
      "<label>Middle Name<input /></label>",
      "<label>Preferred Name<input /></label>",
      "<label>Address Line<input /></label>",
      '<label>City<input value="Chicago" /></label>',
      "<label>Postal Code<input /></label>",
      "<label>Country<input /></label>",
      "<label>Phone Number<input /></label>",
      "<label>Country / Territory Phone Code<input /></label>",
      "<label>LinkedIn<input /></label>",
      '<label>Phone Device Type<select><option value="">Select</option><option>Mobile</option></select></label>',
    ].join(""),
  );
  const profile = {
    ...emptyCandidate,
    contact: {
      ...emptyCandidate.contact,
      middleName: "J",
      preferredName: "MJ",
      addressLine1: "Example Street",
      city: "Chicago",
      postalCode: "60618",
      country: "United States of America",
      phone: "5550100",
      phoneCountryCode: "+1",
      phoneType: "Mobile",
      linkedIn: "https://linkedin.com/in/example",
    },
  };
  const result = await fillWorkdayContact(page, profile);
  expect(result.filled).toEqual(
    expect.arrayContaining([
      "middleName",
      "preferredName",
      "addressLine1",
      "city",
      "postalCode",
      "country",
      "phone",
      "phoneCountryCode",
      "phoneType",
      "linkedIn",
    ]),
  );
  expect(await page.getByLabel("Phone Number").inputValue()).toBe("5550100");
  expect(
    await page.getByLabel("Country / Territory Phone Code").inputValue(),
  ).toBe("+1");
  expect(await page.getByLabel("City").inputValue()).toBe("Chicago");
  expect(await fillWorkdayContact(page, profile)).toEqual(result);
});
