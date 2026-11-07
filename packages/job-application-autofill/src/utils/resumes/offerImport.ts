import type { ResumeImportActionsContext, ApplyImportedContent } from "./import-context";
import type { CandidateProfile } from "../../index";

export function createOfferImport(context: ResumeImportActionsContext & { applyImportedContent: ApplyImportedContent }) {
  const { profile, contactId, contactKeys, setMessage, setImportChoices, setPendingImport, applyImportedContent } = context;
  function offerImport(incoming: CandidateProfile) {
    setImportChoices({});
    if (
      contactKeys.some(
        (key) =>
          (incoming.contact[key] || "").trim() !==
          (profile.contact[key] || "").trim(),
      )
    ) {
      setPendingImport(incoming);
      setMessage("Contact details extracted. Review them before importing.");
    } else applyImportedContent(incoming, contactId, incoming.contact);
  }
  return offerImport;
}
