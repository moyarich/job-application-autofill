import type { ProfileResumeActionsContext } from "../../types/profile-resume-actions-context";
import { exportResume } from "../files/export-resume";
import type { ResumeExportFormat } from "../files/export-resume";
import { readResumeContent } from "../../api/client";

export function createExportResumeVersion(
  context: ProfileResumeActionsContext,
) {
  const { activeProfileId, resumeVersions, flushPending, setMessage } = context;
  async function exportResumeVersion(
    resumeId: string,
    format: ResumeExportFormat,
  ) {
    try {
      await flushPending();
      const selected = resumeVersions.find((item) => item.id === resumeId);
      if (!selected) throw new Error("Resume no longer exists.");
      const { profile: value } = await readResumeContent(
        activeProfileId,
        resumeId,
      );
      if (!value) throw new Error("This resume has no content to export.");
      await exportResume(
        value,
        selected.name,
        format,
        activeProfileId,
        resumeId,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }
  return exportResumeVersion;
}
