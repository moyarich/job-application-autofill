import type { JobSiteAdapter } from "../../types.ts";
import { firstPathTenant } from "../../tenant.ts";

// Greenhouse host and employer identity. Form behavior belongs to site-owned steps.
export default {
  id: "greenhouse",
  label: "Greenhouse",
  hosts: ["greenhouse.io"],
  employerTenant: (url: URL) => {
    const host = url.hostname.toLowerCase();
    const tenant = firstPathTenant(url);
    return ["boards.greenhouse.io", "job-boards.greenhouse.io"].includes(host)
      ? tenant
      : host + "/" + (tenant || "");
  },
} satisfies JobSiteAdapter;
