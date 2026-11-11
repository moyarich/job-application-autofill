import { EMPTY_CANDIDATE } from "../../constants";
import type {
  ContactActionsContext,
  Contact,
} from "../../types/contact-actions-context";
export function createChooseContact(context: ContactActionsContext) {
  const { contacts, contactKeys, setProfile, setContactId, setMessage } =
    context;
  function chooseContact(id: string) {
    if (!id) {
      setContactId(null);
      setMessage("Contact unlinked. This resume remains editable as a draft.");
      return;
    }
    const selected = contacts.find((item) => item.id === id);
    if (!selected) return;
    setContactId(id);
    const contact: Contact = { ...EMPTY_CANDIDATE.contact };
    for (const key of contactKeys) contact[key] = selected[key] || "";
    setProfile((previous) => ({ ...previous, contact }));
  }
  return chooseContact;
}
