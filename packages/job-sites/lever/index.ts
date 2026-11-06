import type { JobSiteAdapter } from "../types.ts";
import { firstPathTenant } from "../tenant.ts";

// Lever adapter.
export default { id: "lever", label: "Lever", hosts: ["lever.co"], employerTenant: firstPathTenant, fields: { firstName: [/first.?name/i], lastName: [/last.?name/i], fullName: [/full.?name|your name/i], email: [/email/i], phone: [/phone/i], location: [/location|city/i], linkedIn: [/linkedin/i], github: [/github/i], website: [/website|portfolio/i] } } satisfies JobSiteAdapter;
