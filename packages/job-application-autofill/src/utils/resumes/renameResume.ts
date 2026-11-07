import type { ProfileResumeActionsContext } from "./library-context";
import { renameResumeVersion } from "../api/client";

export function createRenameResume(context: ProfileResumeActionsContext) {
  const { applicationId, applyBusy, sessionActive, activeProfileId, flushPending, setMessage, setResumeVersions } = context;
  async function renameResume(resumeId: string, name: string) {
    if (applicationId || applyBusy || sessionActive) return;
    try {
      await flushPending();
      const changed = await renameResumeVersion(
        activeProfileId,
        resumeId,
        name,
      );
      setResumeVersions((items) =>
        items.map((item) => (item.id === changed.id ? changed : item)),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  return renameResume;
}
