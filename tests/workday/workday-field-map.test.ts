import { test, expect } from "vitest";
import { chromium } from "playwright";
import { workdayContactFields } from "../../packages/job-sites/workday/contact/selectors.ts";
import { fillWorkdayContact, findMappedField } from "../../packages/job-sites/workday/contact/contact.ts";
import { emptyCandidate } from "../../packages/job-application-autofill/src/index.ts";

test("Workday selector object supports alternate labels without changing the autofill code", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <label>Given Name<input id="given"></label>
      <label>Family Name<input id="family"></label>
      <label>Email Address<input id="email"></label>
      <label>Country Phone Code<input id="phone-code"></label>
      <label>Phone Number<input id="phone"></label>
    `);
    const result = await fillWorkdayContact(page, {
      ...emptyCandidate,
      contact: {
        ...emptyCandidate.contact,
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        phone: "8475550100",
      },
    });
    expect(result.missing).toEqual([]);
    expect(result.filled).toEqual(["firstName", "lastName", "email", "phone"]);
    expect(await page.locator("#given").inputValue()).toBe("Ada");
    expect(await page.locator("#family").inputValue()).toBe("Lovelace");
    expect(await page.locator("#email").inputValue()).toBe("ada@example.com");
    expect(await page.locator("#phone").inputValue()).toBe("8475550100");
    expect(await page.locator("#phone-code").inputValue()).toBe("");
  } finally {
    await browser.close();
  }
});

test("missing, ambiguous, and conflicting Workday fields are left for review", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <label>First Name<input id="one"></label>
      <label>First Name<input id="two"></label>
      <label>Last Name<input id="last" value="Existing"></label>
      <label>Email<input id="email" readonly></label>
      <label>Country Phone Code<input id="code"></label>
    `);
    const result = await fillWorkdayContact(page, {
      ...emptyCandidate,
      contact: {
        ...emptyCandidate.contact,
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        phone: "8475550100",
      },
    });
    expect(result.filled).toEqual([]);
    expect(result.missing).toEqual(["firstName", "lastName", "email", "phone"]);
    expect(await page.locator("#one").inputValue()).toBe("");
    expect(await page.locator("#two").inputValue()).toBe("");
    expect(await page.locator("#last").inputValue()).toBe("Existing");
    expect(await page.locator("#code").inputValue()).toBe("");
  } finally {
    await browser.close();
  }
});

test("Workday contact selector lookup supports a verified CSS fallback and rejects unsafe controls", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <input id="name" data-field="verified-first-name">
      <input id="password" type="password" data-field="password">
    `);
    const rules = {
      first: { labels: [/^not present$/i], selectors: ['[data-field="verified-first-name"]'] },
      password: { labels: [], selectors: ['[data-field="password"]'] },
    };
    expect(await findMappedField(page, rules, "first")).not.toBeNull();
    expect(await findMappedField(page, rules, "password")).toBeNull();
    expect(Object.hasOwn(workdayContactFields, "firstName")).toBe(true);
  } finally {
    await browser.close();
  }
});
