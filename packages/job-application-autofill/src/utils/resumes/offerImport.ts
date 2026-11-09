import type { ResumeImportActionsContext, ApplyImportedContent } from "./import-context";
import type { CandidateProfile } from "../../index";

export function createOfferImport(context: ResumeImportActionsContext & { applyImportedContent: ApplyImportedContent }) {
  const { setMessage, setImportChoices, setPendingImport } = context;
  function offerImport(incoming: CandidateProfile) {
    setImportChoices({});
    setPendingImport(incoming);
    setMessage("Resume details extracted. Review them before importing.");
  }
  return offerImport;
}
