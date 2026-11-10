import type { ProfileResumeActionsContext } from "../../types/profile-resume-actions-context";
import { createSwitchProfile } from "./switchProfile";
import { createSwitchResume } from "./switchResume";
import { createCreatePerson } from "./createPerson";
import { createRenamePerson } from "./renamePerson";
import { createRemovePerson } from "./removePerson";
import { createExportResumeVersion } from "./exportResumeVersion";
import { createOpenResume } from "./openResume";
import { createCreateResume } from "./createResume";
import { createRenameResume } from "./renameResume";
import { createRemoveResume } from "./removeResume";

/** Bind independent resume commands to a page-scoped record. */
export function createResumeCommands(
  state: Omit<
    ProfileResumeActionsContext,
    "applyBusy" | "sessionActive" | "pathname"
  >,
) {
  const context: ProfileResumeActionsContext = {
    ...state,
    applyBusy: false,
    sessionActive: false,
    pathname: window.location.pathname,
  };
  return {
    switchProfile: createSwitchProfile(context),
    switchResume: createSwitchResume(context),
    createPerson: createCreatePerson(context),
    renamePerson: createRenamePerson(context),
    removePerson: createRemovePerson(context),
    exportResumeVersion: createExportResumeVersion(context),
    openResume: createOpenResume(context),
    createResume: createCreateResume(context),
    renameResume: createRenameResume(context),
    removeResume: createRemoveResume(context),
  };
}
