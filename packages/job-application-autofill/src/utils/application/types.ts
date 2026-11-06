export type AtsQuestion = {
  label: string;
  kind: "text" | "textarea" | "select" | "combobox" | "radio" | "checkbox";
  required: boolean;
  options: string[];
};
export type ApplySession = {
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
