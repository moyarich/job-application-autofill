import type { ContactActionsContext } from "./contact-context";
import { createEditContact } from "./editContact";
import { createChooseContact } from "./chooseContact";
import { createSaveContactRecord } from "./saveContactRecord";
import { createMarkDefaultContact } from "./markDefaultContact";
/** Bind independent contact commands to the current page's record. */
export function createContactCommands(context: ContactActionsContext) {
  return {
    editContact: createEditContact(context),
    chooseContact: createChooseContact(context),
    saveContactRecord: createSaveContactRecord(context),
    markDefaultContact: createMarkDefaultContact(context),
  };
}
