import { Resume } from "@moyarich/resume";
import { ApplicationStatus } from "../types/job-application";

export const fields: {
  key: keyof Resume["contact"];
  label: string;
  placeholder?: string;
}[] = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "middleName", label: "Middle name" },
  { key: "preferredName", label: "Preferred name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "location", label: "Location" },
  { key: "addressLine1", label: "Street address" },
  { key: "addressLine2", label: "Address line 2" },
  { key: "city", label: "City" },
  { key: "state", label: "State or region" },
  { key: "postalCode", label: "Postal code" },
  { key: "country", label: "Country" },
  { key: "phoneCountryCode", label: "Phone country code" },
  { key: "phoneType", label: "Phone device type" },

  { key: "linkedIn", label: "LinkedIn URL" },
  { key: "github", label: "GitHub URL" },
  { key: "website", label: "Website" },
];
export const statusLabels: Record<ApplicationStatus, string> = {
  saved: "Saved",
  in_progress: "In progress",
  ready_for_review: "Ready for review",
  submitted: "Submitted",
  interview: "Interview",
  rejected: "Rejected",
};
