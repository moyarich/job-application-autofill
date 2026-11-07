import type { ProfileResumeActionsContext } from "./library-context";
import { createLocalProfile } from "../api/client";
import { navigateTo } from "./navigateTo";

export function createCreatePerson(context: ProfileResumeActionsContext) {
  const { profile, flushPending, setMessage } = context;
  async function createPerson() {
    const value = window.prompt("Name for the new local profile");
    if (!value) return;
    try {
      await flushPending();
      const result = await createLocalProfile(value);
      navigateTo(result.id);
    } catch (error) {
      setMessage(String(error));
    }
  }
  return createPerson;
}
