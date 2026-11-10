import type { ContactActionsContext } from "./contact-context";
import { chooseDefaultContact } from "../api/client";
export function createMarkDefaultContact(context: ContactActionsContext) {
  const {
    contactId,
    activeProfileId,
    flushPending,
    setContacts,
    setDefaultContactId,
    setMessage,
  } = context;
  async function markDefaultContact() {
    if (!contactId) return;
    try {
      await flushPending();
      const changed = await chooseDefaultContact(activeProfileId, contactId);
      setContacts((previous) =>
        previous.map((item) => ({
          ...item,
          isDefault: item.id === changed.id,
        })),
      );
      setDefaultContactId(changed.id);
      setMessage("Default contact updated for new resumes.");
    } catch (error) {
      setMessage(String(error));
    }
  }
  return markDefaultContact;
}
