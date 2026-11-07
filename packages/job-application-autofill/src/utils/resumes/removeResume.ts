import { routes } from "../../routes";
import type { ProfileResumeActionsContext } from "./library-context";
import { deleteResumeVersion } from "../api/client";
import { navigateTo } from "./navigateTo";

export function createRemoveResume(context: ProfileResumeActionsContext) {
  const { applicationId, applyBusy, sessionActive, activeProfileId, activeResumeId, resumeVersions, flushPending, setMessage, setResumeVersions } = context;
  async function removeResume(resumeId: string) {
    if (applicationId || applyBusy || sessionActive || resumeVersions.length <= 1)
      return;
    try {
      await flushPending();
      await deleteResumeVersion(activeProfileId, resumeId);
      if (resumeId === activeResumeId) {
        const remaining = resumeVersions.find((item) => item.id !== resumeId);
        navigateTo(activeProfileId, remaining?.id, routes.resumes);
      } else {
        setResumeVersions((items) =>
          items.filter((item) => item.id !== resumeId),
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  return removeResume;
}
