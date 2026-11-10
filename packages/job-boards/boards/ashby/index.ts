import type { JobSiteAdapter } from "../../types.ts";
import { firstPathTenant } from "../../tenant.ts";

// Ashby adapter.
export default {
  id: "ashby",
  label: "Ashby",
  hosts: ["ashbyhq.com"],
  employerTenant: firstPathTenant,
} satisfies JobSiteAdapter;
