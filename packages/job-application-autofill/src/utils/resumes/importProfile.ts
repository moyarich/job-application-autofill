import { parseResumeJson } from "@moyarich/resume/validate";

import type {
  ResumeImportActionsContext,
  OfferImport,
} from "../../types/resume-import-actions-context";

import type React from "react";

export function createImportProfile(
  context: ResumeImportActionsContext & { offerImport: OfferImport },
) {
  const { setMessage, offerImport } = context;
  async function importProfile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      offerImport(parseResumeJson(await file.text()));
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
