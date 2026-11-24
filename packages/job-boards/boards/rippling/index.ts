import type { Page } from "playwright";
import { firstPathTenant } from "../../tenant.ts";
import type { JobSiteAdapter, JobSiteStep } from "../../types.ts";

const hosts = ["ats.rippling.com", "ats.us1.rippling.com"];
const postingPath =
  /^\/[a-z0-9_-]+\/jobs\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(?:\/(apply))?\/?$/i;

function posting(page: Page) {
  const url = new URL(page.url());
  if (url.protocol !== "https:" || !hosts.includes(url.host)) return null;
  return url.pathname.match(postingPath);
}

function applicationForm(page: Page) {
  return page.locator("form").filter({
    has: page.getByTestId("input-email"),
  });
}

async function applicationVisible(page: Page) {
  return (
    posting(page)?.[1] === "apply" &&
    (await applicationForm(page).getByTestId("input-email").isVisible())
  );
}

async function openApplication(page: Page) {
  const match = posting(page);
  if (!match) return;
  if (!match[1]) {
    const listing = new URL(page.url());
    const path = listing.pathname.replace(/\/$/, "") + "/apply";
    await Promise.all([
      page.waitForURL(
        (url) => url.origin === listing.origin && url.pathname === path,
        { timeout: 8000 },
      ),
      page
        .getByRole("button", { name: "Apply now", exact: true })
        .filter({ visible: true })
        .first()
        .click({ timeout: 5000 }),
    ]);
  }
  await applicationForm(page)
    .getByTestId("input-email")
    .waitFor({ state: "visible", timeout: 8000 });
}

async function nationalPhone(page: Page, value: string) {
  const phone = value.trim();
  if (!phone.startsWith("+")) return phone;

  const code = await applicationForm(page)
    .getByTestId("input-phone_number")
    .locator("xpath=ancestor::*[.//input[@role='combobox']][1]")
    .getByRole("combobox")
    .filter({ visible: true })
    .inputValue({ timeout: 500 })
    .catch(() => "");
  const prefix = code.match(/^\+\d+/)?.[0];
  return prefix && phone.startsWith(prefix)
    ? phone.slice(prefix.length).trim()
    : "";
}

const details: JobSiteStep = {
  id: "rippling.details",
  matches: ({ page }) => applicationVisible(page),
  async run({ page, profile }) {
    const form = applicationForm(page);
    const { contact, experience } = profile;
    const recent = [...experience].sort(
      (left, right) =>
        Number(right.isCurrent) - Number(left.isCurrent) ||
        right.startDate.localeCompare(left.startDate),
    )[0];
    const fields = [
      ["First name", "first_name", contact.firstName],
      ["Last name", "last_name", contact.lastName],
      ["Email", "email", contact.email],
      [
        "Phone number",
        "phone_number",
        await nationalPhone(page, contact.phone ?? ""),
      ],
      ["Current company", "current_company", recent?.company],
      ["LinkedIn", "linkedin_link", contact.linkedIn],
      ["Website", "website_link", contact.website],
    ] as const;
    const filled: string[] = [];
    const missing: string[] = [];
    for (const [label, name, value] of fields) {
      const input = form.getByTestId("input-" + name).filter({ visible: true });
      if ((await input.count()) !== 1) continue;
      try {
        if ((await input.inputValue({ timeout: 2000 })).trim()) continue;
        if (value?.trim()) {
          await input.fill(value.trim(), { timeout: 2000 });
          filled.push(label);
        } else if ((await input.getAttribute("aria-required")) === "true") {
          missing.push(label);
        }
      } catch {
        missing.push(label);
      }
    }
    return { filled, missing };
  },
};

const resume: JobSiteStep = {
  id: "rippling.resume",
  matches: async ({ page, pendingResume }) =>
    Boolean(pendingResume?.buffer.length) && (await applicationVisible(page)),
  async run({ page, pendingResume }) {
    if (!pendingResume) return { filled: [], missing: [] };
    const input = applicationForm(page)
      .getByTestId("input-resume")
      .and(page.locator('input[type="file"]'));
    if ((await input.count()) !== 1) return { filled: [], missing: ["Resume"] };
    try {
      if (await input.inputValue({ timeout: 2000 }))
        return { filled: [], missing: [] };
      await input.setInputFiles(
        {
          name: pendingResume.fileName,
          mimeType: "application/pdf",
          buffer: pendingResume.buffer,
        },
        { timeout: 3000 },
      );
      return { filled: ["Resume"], missing: [], pendingResume: null };
    } catch {
      return { filled: [], missing: ["Resume"] };
    }
  },
};

export default {
  id: "rippling",
  label: "Rippling",
  hosts,
  employerTenant: firstPathTenant,
  openApplication,
  steps: [details, resume],
  menuItems: [
    { id: "details", label: "Application details", stepId: details.id },
    { id: "resume", label: "Resume", stepId: resume.id },
  ],
} satisfies JobSiteAdapter;
