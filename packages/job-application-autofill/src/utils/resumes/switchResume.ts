import { resumeSwitchPath } from "../../routes";
import type { ProfileResumeActionsContext } from "./library-context";
import { navigateTo } from "./navigateTo";

export function createSwitchResume(context: ProfileResumeActionsContext) {
  const {
    applicationId,
    applyBusy,
    sessionActive,
    activeProfileId,
    activeResumeId,
    pathname,
    flushPending,
    setMessage,
  } = context;
  async function switchResume(next: string) {
    if (applicationId || applyBusy || sessionActive || next === activeResumeId)
      return;
    try {
      await flushPending();
      // Preserve the current resume page when switching versions.
      const destination = resumeSwitchPath(pathname);
      navigateTo(activeProfileId, next, destination);
    } catch (error) {
      setMessage(String(error));
    }
  }
  return switchResume;
}
