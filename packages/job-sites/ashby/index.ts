import type { JobSiteAdapter } from "../types.ts";
import { firstPathTenant } from "../tenant.ts";

// Ashby adapter.
export default { id: "ashby", label: "Ashby", hosts: ["ashbyhq.com"], employerTenant: firstPathTenant, fields: { firstName: [/first.?name/i], lastName: [/last.?name/i], fullName: [/full.?name/i], email: [/email/i], phone: [/phone/i], location: [/location|city/i], linkedIn: [/linkedin/i], github: [/github/i], website: [/website|portfolio/i] } } satisfies JobSiteAdapter;
