import type { ProfileResumeActionsContext } from "./library-context";
import { exportResume } from "../files/export-resume";
import type { ResumeExportFormat } from "../files/export-resume";
import { readState } from "../api/client";

export function createExportResumeVersion(context: ProfileResumeActionsContext) {
  const { activeProfileId, activeResumeId, profile, resumeVersions, flushPending, setMessage } = context;
  async function exportResumeVersion(
    resumeId: string,
    format: ResumeExportFormat,
  ) {
    try {
      await flushPending();
      const selected = resumeVersions.find((item) => item.id === resumeId);
      if (!selected) throw new Error("Resume no longer exists.");
      const state =
        resumeId === activeResumeId
          ? null
          : await readState(activeProfileId, resumeId);
      const value = state ? state.profile : profile;
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
