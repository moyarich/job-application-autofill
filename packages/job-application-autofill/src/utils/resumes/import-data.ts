import type { ResumeImportActionsContext } from "./import-context";

/** Shared resume/contact dependencies supplied by the page. */
export type ResumeImportData = Pick<
  ResumeImportActionsContext,
  | "profile"
  | "contactId"
  | "activeProfileId"
  | "activeResumeId"
  | "contactKeys"
  | "flushPending"
  | "setTab"
  | "setMessage"
  | "setProfile"
  | "setContactId"
  | "setContacts"
  | "setDefaultContactId"
>;
