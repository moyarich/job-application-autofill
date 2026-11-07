import type { ResumeImportActionsContext, ApplyImportedContent } from "./import-context";
import { resolveImportedContact } from "../api/client";
import type { ContactChoice } from "../api/client";
import type { ContactKey } from "./import-context";

export function createConfirmImport(context: ResumeImportActionsContext & { applyImportedContent: ApplyImportedContent }) {
  const { activeProfileId, activeResumeId, contactKeys, pendingImport, flushPending, setMessage, setContacts, setDefaultContactId, applyImportedContent } = context;
  async function confirmImport(strategy: ContactChoice = "resume") {
    if (!pendingImport || !activeResumeId) return;
    try {
      await flushPending();
      const choices = Object.fromEntries(
        contactKeys.map((key) => [key, strategy]),
      ) as Partial<Record<ContactKey, ContactChoice>>;
      const result = await resolveImportedContact(
        activeProfileId,
        activeResumeId,
        pendingImport.contact,
        choices,
      );
      setContacts(result.contacts);
      if (result.contacts.some((item) => item.isDefault)) {
        setDefaultContactId(result.contacts.find((item) => item.isDefault)!.id);
      }
      applyImportedContent(pendingImport, result.contactId, result.contact);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not import resume.",
      );
    }
  }
  return confirmImport;
}
