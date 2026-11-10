import type { Resume } from "@moyarich/resume";

export function validateResume(resume: Resume): string[] {
  const errors: string[] = [];
  if (!resume.contact.firstName.trim()) errors.push("First name is required");
  if (!resume.contact.lastName.trim()) errors.push("Last name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resume.contact.email.trim()))
    errors.push("Valid email is required");
  return errors;
}
