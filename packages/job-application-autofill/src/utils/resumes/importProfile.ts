import type { ResumeImportActionsContext, OfferImport } from "./import-context";
import { parseCandidateJson } from "../../index";
import type React from "react";

export function createImportProfile(
  context: ResumeImportActionsContext & { offerImport: OfferImport },
) {
  const { setMessage, offerImport } = context;
  async function importProfile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      offerImport(parseCandidateJson(await file.text()));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Invalid JSON profile",
      );
    } finally {
      event.target.value = "";
    }
  }
  return importProfile;
}
