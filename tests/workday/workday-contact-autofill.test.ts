import { test, expect } from "vitest";
import { chromium } from "playwright";
import { fillKnownFields } from "../../packages/job-sites/automation.ts";
import { emptyCandidate } from "../../packages/job-application-autofill/src/index.ts";

test("fills structured contact data without confusing phone number with country code", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route("**/*", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `
      <label>Country Phone Code<input id="code"></label>
      <label>Phone Number*<input id="phone"></label>
      <label>Address Line 1*<input id="street"></label>
      <label>City*<input id="city"></label>
      <label for="state">State*</label><select id="state"><option></option><option>Illinois</option></select>
      <label>Postal Code*<input id="zip"></label>`,
      }),
    );
    await page.goto("https://uchicago.wd5.myworkdayjobs.com/application");
    await fillKnownFields(page, {
      ...emptyCandidate,
      contact: {
        ...emptyCandidate.contact,
        phone: "8475550100",
        addressLine1: "123 Example St",
        city: "Chicago",
        state: "Illinois",
        postalCode: "60618",
      },
    });
    expect(await page.locator("#code").inputValue()).toBe("");
    expect(await page.locator("#phone").inputValue()).toBe("8475550100");
    expect(await page.locator("#street").inputValue()).toBe("123 Example St");
    expect(await page.locator("#city").inputValue()).toBe("Chicago");
    expect(await page.locator("#state").inputValue()).toBe("Illinois");
    expect(await page.locator("#zip").inputValue()).toBe("60618");
  } finally {
    await browser.close();
  }
});
