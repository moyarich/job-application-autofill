// Greenhouse adapter.
export default { id: "greenhouse", label: "Greenhouse", hosts: ["greenhouse.io"], fields: { firstName: [/first.?name/i], lastName: [/last.?name/i], email: [/email/i], phone: [/phone/i], location: [/location|city/i], linkedIn: [/linkedin/i], github: [/github/i], website: [/website|portfolio/i] } };
