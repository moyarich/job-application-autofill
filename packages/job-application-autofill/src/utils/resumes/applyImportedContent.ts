import type { ResumeImportActionsContext } from "../../types/resume-import-actions-context";
import { Resume } from "@moyarich/resume";
import type { Contact } from "../../types/resume-import-actions-context";

export function createApplyImportedContent(
  context: ResumeImportActionsContext,
) {
  const {
    setMessage,
    setImportChoices,
    setPendingImport,
    setContactId,
    setProfile,
    setResume,
  } = context;
  function applyImportedContent(
    incoming: Resume,
    selectedId: string | null,
    resolved: Contact,
  ) {
    setContactId(selectedId);
    setProfile({ ...incoming, contact: resolved });
    setPendingImport(null);
    setImportChoices({});
    setResume(null);
    setMessage("Resume imported with its selected contact record.");
  }
  return applyImportedContent;
}
