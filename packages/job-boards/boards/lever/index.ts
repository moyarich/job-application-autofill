import type { JobSiteAdapter } from "../../types.ts";
import { firstPathTenant } from "../../tenant.ts";

// Lever adapter.
export default {
  id: "lever",
  label: "Lever",
  hosts: ["lever.co"],
  employerTenant: firstPathTenant,
} satisfies JobSiteAdapter;
