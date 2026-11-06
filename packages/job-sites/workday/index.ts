// Workday adapter.
export default {
  id: "workday",
  label: "Workday",
  hosts: ["myworkdayjobs.com", "workday.com"],
  fields: {
    firstName: [/first.?name/i],
    lastName: [/last.?name/i],
    email: [/email/i],
    phone: [/^phone number\s*\*?$/i],
    location: [/^location\s*\*?$/i],
    linkedIn: [/linkedin/i],
    github: [/github/i],
    website: [/website|portfolio/i],
  },
};
