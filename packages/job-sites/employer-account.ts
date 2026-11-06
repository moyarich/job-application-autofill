import { adapterForUrl } from "./index.ts";

export type EmployerAccountIdentity = {
  provider: string;
  employerKey: string;
  employerName: string;
  host: string;
};

/**
 * Identify the employer tenant, not the job or application.
 * Different employers sharing an ATS must not share an account.
 */
export function employerAccountIdentity(jobUrl: string, company: string): EmployerAccountIdentity | null {
  const url = new URL(jobUrl);
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const adapter = adapterForUrl(jobUrl);
  if (!adapter) return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  let tenant: string | undefined;
  if (adapter.id === "workday") {
    // Workday employer environments have dedicated hosts, e.g. acme.wd5.myworkdayjobs.com.
    tenant = host.endsWith(".myworkdayjobs.com") ? host : undefined;
  } else if (adapter.id === "greenhouse") {
    tenant = parts[0]?.toLowerCase();
    // Greenhouse also uses custom board hosts; retain the host to avoid collisions.
    if (!["boards.greenhouse.io", "job-boards.greenhouse.io"].includes(host))
      tenant = host + "/" + (tenant || "");
  } else if (["lever", "ashby", "smart-recruiters"].includes(adapter.id)) {
    tenant = parts[0]?.toLowerCase();
  }
  if (!tenant || tenant.length > 250) return null;
  const name = company.trim().slice(0, 200);
  if (!name) return null;
  return { provider: adapter.id, employerKey: tenant, employerName: name, host };
}
