import { resumePath } from "../../routes";
import type { ProfileResumeActionsContext } from "./library-context";
import { navigateTo } from "./navigateTo";

export function createOpenResume(context: ProfileResumeActionsContext) {
  const {
    applicationId,
    applyBusy,
    sessionActive,
    activeProfileId,
    flushPending,
    setMessage,
  } = context;
  async function openResume(resumeId: string, mode: "view" | "edit" = "edit") {
    if (applicationId || applyBusy || sessionActive) return;
    try {
      await flushPending();
      navigateTo(activeProfileId, resumeId, resumePath(mode));
    } catch (error) {
      setMessage(String(error));
    }
  }
  return openResume;
}
