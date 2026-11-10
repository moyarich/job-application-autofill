export type ApplicationStatus =
  | "saved"
  | "in_progress"
  | "ready_for_review"
  | "submitted"
  | "interview"
  | "rejected";

export type JobPostingDetails = {
  salary?: string;
  location?: string;
  employmentType?: string;
  requisitionId?: string;
  description?: string;
  postingUrl?: string;
};
export interface JobApplication {
  id: string;
  company: string;
  role: string;
  url: string;
  status: ApplicationStatus;
  createdAt: string;
  notes: string;
  resumeId?: string | null;
  accountAction?: "signup" | "login";
  details?: JobPostingDetails;
}
