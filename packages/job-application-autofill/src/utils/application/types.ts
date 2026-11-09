export type AtsQuestion = {
  label: string;
  kind: "text" | "textarea" | "select" | "combobox" | "radio" | "checkbox";
  required: boolean;
  options: string[];
};
export type EmployerAccount = {
  provider: string;
  employerKey: string;
  employerName: string;
  host: string;
  status: "setup_required" | "ready";
  updatedAt: string;
};
export type SignupPrepared = { submitted?: boolean; credentialSource?: "configured" | "provided" | "none"; state: "unavailable" | "not_required" | "prepared" | "manual_required"; filled: string[]; missing: string[] };
export type ApplySession = {
  employerAccount?: EmployerAccount | null;
  signupPrepared?: SignupPrepared | null;
  id: string;
  jobId: string;
  state: string;
  message: string;
  url: string;
  screenshot: string | null;
  reviewUrl: string | null;
  filled: string[];
  missing: string[];
  ats?: string;
  questions?: AtsQuestion[];
  answerResult?: { filled: string[]; unresolved: string[] };
};
