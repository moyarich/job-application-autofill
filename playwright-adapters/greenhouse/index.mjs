// Greenhouse field mappings, including hosted job-boards.greenhouse.io applications.
// Never invent preferred names, authorization, sponsorship or screening answers.
export default {
  id: "greenhouse",
  label: "Greenhouse",
  hosts: ["greenhouse.io"],
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
};
