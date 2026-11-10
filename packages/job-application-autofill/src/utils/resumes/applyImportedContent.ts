import type { ResumeImportActionsContext } from "./import-context";
import type { Resume } from "../../index";
import type { Contact } from "./import-context";

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
