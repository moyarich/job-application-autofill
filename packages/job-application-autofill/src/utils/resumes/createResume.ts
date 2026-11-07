import { routes } from "../../routes";
import type { ProfileResumeActionsContext } from "./library-context";
import { createResumeVersion } from "../api/client";
import { navigateTo } from "./navigateTo";

export function createCreateResume(context: ProfileResumeActionsContext) {
  const { applicationId, applyBusy, sessionActive, activeProfileId, flushPending, setMessage } = context;
  async function createResume(name: string, copyId?: string) {
    if (applicationId || applyBusy || sessionActive) return;
    try {
      await flushPending();
      const created = await createResumeVersion(activeProfileId, name, copyId);
      navigateTo(activeProfileId, created.id, routes.resumeEditor);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  return createResume;
}
