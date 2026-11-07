import type { ProfileResumeActionsContext } from "./library-context";
import { navigateTo } from "./navigateTo";

export function createSwitchResume(context: ProfileResumeActionsContext) {
  const { applicationId, applyBusy, sessionActive, activeProfileId, activeResumeId, pathname, flushPending, setMessage } = context;
  async function switchResume(next: string) {
    if (applicationId || applyBusy || sessionActive || next === activeResumeId)
      return;
    try {
      await flushPending();
      // Switching versions must not unexpectedly leave the resume editor/preview.
      const destination =
        pathname === "/resumes/edit" ||
        pathname === "/resumes/view" ||
        pathname === "/resumes"
          ? pathname
          : "/workspace";
      navigateTo(activeProfileId, next, destination);
    } catch (error) {
      setMessage(String(error));
    }
  }
  return switchResume;
}
