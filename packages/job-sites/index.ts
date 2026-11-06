import type { Page } from "playwright";

export interface ApplicationQuestion {
  label: string;
  kind: "radio" | "checkbox" | "select" | "combobox" | "textarea" | "text";
  required: boolean;
  options: string[];
}

import greenhouse from "./greenhouse/index.ts";
import lever from "./lever/index.ts";
import workday from "./workday/index.ts";
import ashby from "./ashby/index.ts";
import smartRecruiters from "./smart-recruiters/index.ts";

export const ADAPTERS = Object.freeze({
  greenhouse, lever, workday, ashby, "smart-recruiters": smartRecruiters,
});
const UNSAFE_QUESTIONS = /(?:password|passcode|verification code|otp|one.time code|social security|ssn|date of birth|birth date|credit card|bank account|passport|driver.?s license|tax id|national id)/i;
const VOLUNTARY_QUESTIONS = /(?:race|ethnic|gender|transgender|hispanic|latino|disab|veteran|sexual orientation|pronouns|demographic|self.identif)/i;

export function adapterForUrl(url: string) {
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  for (const [id, adapter] of Object.entries(ADAPTERS))
    if (adapter.hosts.some(domain => host === domain || host.endsWith("." + domain)))
      return { ...adapter, id };
  return null;
}

export function formState(text: string, url = "") {
  if (/captcha|verify you are human|security challenge|cloudflare check/i.test(text))
    return "manual_intervention";
  const path = new URL(url, "https://example.com").pathname;
  if (/(?:\/login|\/signin|\/sign-in|\/create-account|\/register|\/auth(?:\/|$))/i.test(path)
      || /(?:sign in to (?:your|continue)|create (?:an?|your) account|log in to (?:apply|continue)|enter your password|check your email for a (?:code|link))/i.test(text))
    return "login_required";
  return "ready_for_review";
}

export function classifyQuestion(label: string) {
  if (UNSAFE_QUESTIONS.test(label)) return "sensitive";
  if (VOLUNTARY_QUESTIONS.test(label)) return "voluntary";
  return "general";
}

// DOM scanning is read-only and does not extract field values or credentials.
export async function discoverQuestions(page: Page): Promise<ApplicationQuestion[]> {
  return page.evaluate(() => {
    const fields = [...document.querySelectorAll("input:not([type=hidden]), textarea, select, [role=combobox], [role=radiogroup]")];
    const normalized: ApplicationQuestion[] = [];
    const seen = new Set<string>();
    for (const el of fields) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.closest("[hidden], [aria-hidden=true]")) continue;
      if (el.getClientRects().length === 0) continue;
      const input = el instanceof HTMLInputElement ? el : null;
      if (input && /^(file|password|submit|button|reset|image)$/i.test(input.type)) continue;
      const group = el.closest("fieldset, [role=group], [role=radiogroup]");
      const legends = group?.querySelector("legend, [role=heading]");
      const idLabel = el.id ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]') : null;
      const label = (legends?.textContent || idLabel?.textContent || el.closest("label")?.textContent
        || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("name") || "").trim().replace(/\s+/g, " ").slice(0, 300);
      if (!label || seen.has(label.toLowerCase())) continue;
      seen.add(label.toLowerCase());
      const required = el.hasAttribute("required") || el.getAttribute("aria-required") === "true" ||
        Boolean(el.closest("[aria-required=true]"));
      const kind = el.matches("[role=radiogroup], input[type=radio]") ? "radio"
        : el.matches("input[type=checkbox]") ? "checkbox"
        : el.matches("select") ? "select"
        : el.matches("[role=combobox]") ? "combobox"
        : el.matches("textarea") ? "textarea" : "text";
      let options: string[] = [];
      if (el instanceof HTMLSelectElement) options = [...el.options].map(option => option.textContent?.trim() || "").filter(Boolean);
      else if (kind === "radio") options = [...(group || el.parentElement || el).querySelectorAll("label")].map(node => node.textContent?.trim() || "").filter(Boolean);
      normalized.push({ label, kind, required, options: options.slice(0, 30) });
    }
    return normalized.slice(0, 100);
  });
}

function findQuestion(questions: ApplicationQuestion[], label: string) {
  const wanted = label.trim().toLowerCase();
  return questions.find(q => q.label.trim().toLowerCase() === wanted);
}

// Only user-provided answers are filled. No guessed work authorization,
// demographics, salary or screening answers.
export async function fillQuestionAnswers(page: Page, questions: ApplicationQuestion[], answers: Record<string, string>) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw new Error("Answers must be a key-value object.");
  const results: { filled: string[]; unresolved: string[] } = { filled: [], unresolved: [] };
  for (const [label, answer] of Object.entries(answers)) {
    const question = findQuestion(questions, label);
    if (!question || classifyQuestion(label) !== "general" || typeof answer !== "string" || !answer.trim()) {
      results.unresolved.push(label);
      continue;
    }
    const value = answer.trim();
    try {
      if (question.kind === "select") {
        await page.getByLabel(label, { exact: true }).first().selectOption({ label: value }, { timeout: 1800 });
      } else if (question.kind === "radio") {
        await page.getByRole("group", { name: label }).getByRole("radio", { name: value }).check({ timeout: 1800 });
      } else if (question.kind === "checkbox") {
        if (!/^(yes|no|true|false)$/i.test(value)) throw new Error("A checkbox answer must be Yes or No");
        const box = page.getByRole("checkbox", { name: label }).first();
        await box.setChecked(/^(yes|true)$/i.test(value), { timeout: 1800 });
      } else if (question.kind === "combobox") {
        const combo = page.getByRole("combobox", { name: label }).first();
        await combo.click({ timeout: 1800 });
        await combo.fill(value, { timeout: 1800 }).catch(() => {});
        const option = page.getByRole("option", { name: value, exact: true }).first();
        if (!(await option.isVisible({ timeout: 1000 }))) throw new Error("No exact combobox option");
        await option.click({ timeout: 1800 });
      } else {
        await page.getByLabel(label, { exact: true }).first().fill(value, { timeout: 1800 });
      }
      results.filled.push(label);
    } catch {
      results.unresolved.push(label);
    }
  }
  return results;
}
