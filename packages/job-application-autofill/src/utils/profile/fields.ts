import type { CandidateProfile, ApplicationStatus } from "../../index";
export const fields: {
  key: keyof CandidateProfile["contact"];
  label: string;
  placeholder?: string;
}[] = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "location", label: "Location" },
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
