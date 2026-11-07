import type { ContactActionsContext, Contact } from "./contact-context";
export function createChooseContact(context: ContactActionsContext) {
  const { contacts, contactKeys, setProfile, setContactId, setMessage } = context;
  function chooseContact(id: string) {
    if (!id) {
      setContactId(null);
      setMessage("Contact unlinked. This resume remains editable as a draft.");
      return;
    }
    const selected = contacts.find((item) => item.id === id);
    if (!selected) return;
    setContactId(id);
    const contact = Object.fromEntries(
      contactKeys.map((key) => [key, selected[key] || ""]),
    ) as Contact;
    setProfile((previous) => ({ ...previous, contact }));
  }
  return chooseContact;
}
