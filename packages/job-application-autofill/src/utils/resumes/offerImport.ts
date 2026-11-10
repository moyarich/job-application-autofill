import type {
  ResumeImportActionsContext,
  ApplyImportedContent,
} from "../../types/resume-import-actions-context";
import { Resume } from "@moyarich/resume";

export function createOfferImport(
  context: ResumeImportActionsContext & {
    applyImportedContent: ApplyImportedContent;
  },
) {
  const { setMessage, setImportChoices, setPendingImport } = context;
  function offerImport(incoming: Resume) {
    setImportChoices({});
    setPendingImport(incoming);
    setMessage("Resume details extracted. Review them before importing.");
  }
  return offerImport;
}
