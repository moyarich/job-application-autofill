import type { ResumeImportActionsContext } from "../../types/resume-import-actions-context";

export function createCancelImport(context: ResumeImportActionsContext) {
  const { setMessage, setImportChoices, setPendingImport } = context;
  function cancelImport() {
    setPendingImport(null);
    setImportChoices({});
    setMessage("Import cancelled. No information was changed.");
  }
  return cancelImport;
}
