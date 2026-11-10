import type { ResumeImportActionsContext } from "./resume-import-actions-context";

/** Shared resume/contact dependencies supplied by the page. */
export type ResumeImportData = Pick<
  ResumeImportActionsContext,
  | "profile"
  | "contactId"
  | "activeProfileId"
  | "activeResumeId"
  | "revisionRef"
  | "contactKeys"
  | "flushPending"
  | "setTab"
  | "setMessage"
  | "setProfile"
  | "setContactId"
  | "setContacts"
  | "setDefaultContactId"
>;
