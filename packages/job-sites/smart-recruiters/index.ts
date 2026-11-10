import type { JobSiteAdapter } from "../types.ts";
import { firstPathTenant } from "../tenant.ts";

// SmartRecruiters adapter.
export default { id: "smart-recruiters", label: "SmartRecruiters", hosts: ["smartrecruiters.com"], employerTenant: firstPathTenant } satisfies JobSiteAdapter;
