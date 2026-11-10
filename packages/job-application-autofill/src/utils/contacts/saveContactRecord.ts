import { validateResume } from "../resumes/validateResume";
import type { ContactActionsContext } from "../../types/contact-actions-context";

import { addProfileContact } from "../api/client";
export function createSaveContactRecord(context: ContactActionsContext) {
  const {
    contactId,
    profile,
    activeProfileId,
    flushPending,
    setContacts,
    setContactId,
    setDefaultContactId,
    setMessage,
  } = context;
  async function saveContactRecord() {
    if (contactId) return;
    const missing = validateResume(profile);
    if (missing.length) {
      setMessage(
        "Complete the contact details before saving a contact record: " +
          missing.join(", "),
      );
      return;
    }
    try {
      await flushPending();
      const created = await addProfileContact(
        activeProfileId,
        "Primary contact",
        profile.contact,
      );
      setContacts((previous) => [...previous, created]);
      setContactId(created.id);
      if (created.isDefault) setDefaultContactId(created.id);
      setMessage("Contact saved and selected for this resume.");
    } catch (error) {
      setMessage(String(error));
    }
  }
  return saveContactRecord;
}
