// Workday adapter.
export default { id: "workday", label: "Workday", hosts: ["myworkdayjobs.com","workday.com"], fields: { firstName: [/first.?name/i], lastName: [/last.?name/i], email: [/email/i], phone: [/phone/i], location: [/city|address/i], linkedIn: [/linkedin/i], github: [/github/i], website: [/website|portfolio/i] } };
