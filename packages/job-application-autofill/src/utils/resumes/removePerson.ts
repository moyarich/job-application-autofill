import type { ProfileResumeActionsContext } from "./library-context";
import { deleteLocalProfile } from "../api/client";
import { DEFAULT_PROFILE_ID } from "../api/client";
import { navigateTo } from "./navigateTo";

export function createRemovePerson(context: ProfileResumeActionsContext) {
  const { activeProfileId, setMessage } = context;
  async function removePerson() {
    if (
      activeProfileId === DEFAULT_PROFILE_ID ||
      !window.confirm(
        "Permanently delete this person, all resume versions, and all saved applications?",
      )
    )
      return;
    try {
      await deleteLocalProfile(activeProfileId);
      navigateTo(DEFAULT_PROFILE_ID);
    } catch (error) {
      setMessage(String(error));
    }
  }
  return removePerson;
}
