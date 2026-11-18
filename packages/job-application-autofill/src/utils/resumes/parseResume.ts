import type {
  ResumeImportActionsContext,
  OfferImport,
} from "../../types/resume-import-actions-context";
import { parseResumeFile, type ResumeParserChoice } from "../../api/resumes";
import { filePayload } from "../files/resume-files";

export function createParseResume(
  context: ResumeImportActionsContext & { offerImport: OfferImport },
) {
  const {
    activeProfileId,
    activeResumeId,
    resume,
    setTab,
    setMessage,
    setParseBusy,
    setParsePreview,
    offerImport,
  } = context;
  async function parseResume(parser: ResumeParserChoice = "standard") {
    if (!resume) {
      setMessage("Choose a PDF or DOCX resume first.");
      setTab("parser");
      return;
    }
    setParseBusy(true);
    setMessage("");
    try {
      const upload = await filePayload(resume);
      const result = await parseResumeFile(
        upload,
        activeProfileId,
        activeResumeId ?? undefined,
        parser,
      );
      offerImport(result.profile);
      setParsePreview(result.preview);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Resume parse failed",
      );
    } finally {
      setParseBusy(false);
    }
  }
  return parseResume;
}
