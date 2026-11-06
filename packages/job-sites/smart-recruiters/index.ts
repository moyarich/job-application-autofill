import type { JobSiteAdapter } from "../types.ts";
import { firstPathTenant } from "../tenant.ts";

// SmartRecruiters adapter.
export default { id: "smart-recruiters", label: "SmartRecruiters", hosts: ["smartrecruiters.com"], employerTenant: firstPathTenant, fields: { firstName: [/first.?name/i], lastName: [/last.?name/i], fullName: [/full.?name/i], email: [/email/i], phone: [/phone/i], location: [/city|location/i], linkedIn: [/linkedin/i], github: [/github/i], website: [/website|portfolio/i] } } satisfies JobSiteAdapter;
