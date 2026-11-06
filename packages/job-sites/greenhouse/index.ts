import type { JobSiteAdapter } from "../types.ts";
import { firstPathTenant } from "../tenant.ts";

// Greenhouse field mappings, including hosted job-boards.greenhouse.io applications.
// Never invent preferred names, authorization, sponsorship or screening answers.
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
  fields: {
    firstName: [/^first name/i],
    lastName: [/^last name/i],
    email: [/^e.?mail/i],
    phone: [/^phone/i],
    location: [/location \(city\)|^city|^location/i],
    linkedIn: [/linkedin (?:profile|url)|linkedin/i],
    github: [/github/i],
    website: [/website|portfolio/i],
  },
} satisfies JobSiteAdapter;
