import { Resume } from "@moyarich/resume";
import { parseResumeJson } from "@moyarich/resume/validate";
import { validateResume } from "./validateResume";

import { generateResumePdf } from "../../api/resumes";
import type { Dispatch, SetStateAction } from "react";

export function createExportResumePdf(context: {
  profile: Resume;
  activeProfileId: string;
  activeResumeId: string | null;
  setMessage: Dispatch<SetStateAction<string>>;
}) {
  const { profile, activeProfileId, activeResumeId, setMessage } = context;
  async function exportResumePdf() {
    try {
      const missing = validateResume(profile);
      if (missing.length)
        throw new Error(
          "Complete contact information first: " + missing.join(", "),
        );
      // Revalidate the entire user-supplied JSON before producing a document.
      const valid = parseResumeJson(JSON.stringify(profile));
      const { base64 } = await generateResumePdf(valid, activeProfileId, activeResumeId ?? undefined);
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const name = [profile.contact.firstName, profile.contact.lastName]
        .filter(Boolean)
        .join("-");
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        (name || "resume").replace(/[^a-z0-9-]/gi, "_") + ".pdf";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Your resume PDF is ready. Review it before submitting.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PDF export failed.");
    }
  }
  return exportResumePdf;
}
