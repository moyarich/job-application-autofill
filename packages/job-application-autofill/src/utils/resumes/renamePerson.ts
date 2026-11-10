import type { ProfileResumeActionsContext } from "../../types/profile-resume-actions-context";
import { renameLocalProfile } from "../../api/client";

export function createRenamePerson(context: ProfileResumeActionsContext) {
  const { activeProfileId, profiles, setMessage, setProfiles } = context;
  async function renamePerson() {
    const value = window.prompt(
      "Rename local profile",
      profiles.find((item) => item.id === activeProfileId)?.name,
    );
    if (!value) return;
    try {
      const result = await renameLocalProfile(activeProfileId, value);
      setProfiles((items) =>
        items.map((item) => (item.id === result.id ? result : item)),
      );
    } catch (error) {
      setMessage(String(error));
    }
  }
  return renamePerson;
}
