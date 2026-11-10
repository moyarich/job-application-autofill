import type {
  ContactActionsContext,
  ContactKey,
} from "../../types/contact-actions-context";
export function createEditContact(context: ContactActionsContext) {
  const { contactId, setProfile, setContacts } = context;
  function editContact(key: ContactKey, value: string) {
    setProfile((previous) => ({
      ...previous,
      contact: { ...previous.contact, [key]: value },
    }));
    setContacts((previous) =>
      previous.map((item) =>
        item.id === contactId ? { ...item, [key]: value } : item,
      ),
    );
  }
  return editContact;
}
