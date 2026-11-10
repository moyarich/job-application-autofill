import type { ProfileResumeActionsContext } from "../../types/profile-resume-actions-context";
import { navigateTo } from "./navigateTo";

export function createSwitchProfile(context: ProfileResumeActionsContext) {
  const {
    applicationId,
    applyBusy,
    sessionActive,
    activeProfileId,
    flushPending,
    setMessage,
  } = context;
  async function switchProfile(next: string) {
    if (applicationId || applyBusy || sessionActive) return;
    if (next === activeProfileId) return;
    try {
      await flushPending();
      navigateTo(next);
    } catch (error) {
      setMessage(String(error));
    }
  }
  return switchProfile;
}
