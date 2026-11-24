import type { Page } from "playwright";
import { firstPathTenant } from "../../tenant.ts";
import type { JobSiteAdapter, JobSiteStep } from "../../types.ts";

const POSTING_PATH = /^\/([a-z0-9_-]+\/[a-f0-9-]{36})(?:\/(application))?\/?$/i;
const NAME = 'input[name="_systemfield_name"]';
const EMAIL = 'input[name="_systemfield_email"]';
const RESUME = 'input[type="file"][id="_systemfield_resume"]';

function posting(page: Page) {
  const url = new URL(page.url());
  if (url.origin !== "https://jobs.ashbyhq.com") return null;
  return url.pathname.match(POSTING_PATH);
}

function applicationForm(page: Page) {
  return page.locator(".ashby-application-form-container");
}

async function applicationVisible(page: Page) {
  return (
    posting(page)?.[2] === "application" &&
    (await applicationForm(page).locator(EMAIL).isVisible())
  );
}

async function openApplication(page: Page) {
  const match = posting(page);
  if (!match) return;
  if (!match[2]) {
    const destination = `/${match[1]}/application`;
    const link = page.locator(`a[href="${destination}"]`).first();
    await link.waitFor({ state: "visible", timeout: 5000 });
    await page.goto(new URL(destination, page.url()).href, {
      waitUntil: "domcontentloaded",
    });
  }
  await applicationForm(page)
    .locator(EMAIL)
    .waitFor({ state: "visible", timeout: 8000 });
}

const details: JobSiteStep = {
  id: "ashby.details",
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
      [
        "Name",
        form.locator(NAME),
        [contact.firstName, contact.lastName].filter(Boolean).join(" "),
      ],
      ["Email", form.locator(EMAIL), contact.email],
      ["Phone", form.getByLabel(/^Phone(?: Number)?\s*\*?$/i), contact.phone],
      ["Location", form.getByLabel(/^Location\s*\*?$/i), contact.location],
      [
        "Current or Most Recent Company",
        form.getByLabel(/^Current or Most Recent Company\s*\*?$/i),
        recent?.company,
      ],
      [
        "Current or Most Recent Title",
        form.getByLabel(/^Current or Most Recent Title\s*\*?$/i),
        recent?.jobTitle,
      ],
      [
        "LinkedIn Profile",
        form.getByLabel(/^LinkedIn Profile\s*\*?$/i),
        contact.linkedIn,
      ],
      ["Website", form.getByLabel(/^Website\s*\*?$/i), contact.website],
    ] as const;
    const filled: string[] = [];
    const missing: string[] = [];
    for (const [label, field, value] of fields) {
      if ((await field.count()) !== 1 || !(await field.isVisible())) continue;
      try {
        if ((await field.inputValue({ timeout: 2000 })).trim()) continue;
        if (!value?.trim()) {
          if (label === "Name" || label === "Email") missing.push(label);
          continue;
        }
        await field.fill(value.trim(), { timeout: 2000 });
        filled.push(label);
      } catch {
        missing.push(label);
      }
    }
    return { filled, missing };
  },
};

const resume: JobSiteStep = {
  id: "ashby.resume",
  matches: async ({ page, pendingResume }) =>
    Boolean(pendingResume?.buffer.length) && (await applicationVisible(page)),
  async run({ page, pendingResume }) {
    if (!pendingResume) return { filled: [], missing: [] };
    const input = applicationForm(page).locator(RESUME);
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
  id: "ashby",
  label: "Ashby",
  hosts: ["ashbyhq.com"],
  employerTenant: firstPathTenant,
  openApplication,
  steps: [details, resume],
  menuItems: [
    { id: "details", label: "Application details", stepId: details.id },
    { id: "resume", label: "Resume", stepId: resume.id },
  ],
} satisfies JobSiteAdapter;
