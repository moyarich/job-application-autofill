import type { ResumeImportActionsContext } from "./import-context";


export function createCancelImport(context: ResumeImportActionsContext) {
  const { setMessage, setImportChoices, setPendingImport } = context;
  function cancelImport() {
    setPendingImport(null);
    setImportChoices({});
    setMessage("Import cancelled. No information was changed.");
  }
  return cancelImport;
}
